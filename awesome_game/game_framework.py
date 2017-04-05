from flask import render_template, make_response, url_for, redirect, request
from flask_login import current_user
from awesome_game import app, db, Highscores, User
from flask_socketio import SocketIO, emit, join_room, leave_room, rooms, Namespace
import random
import time

socketio = SocketIO(app)

room_counter = 1
game_counter = 0

room = {}
user_room = {}


class New_Game(type):
    def __init__(cls, name, bases, attrs):
        ''' Uitgevoert bij het maken van een nieuw spel '''
        if len(cls.mro()) == 3:
            from awesome_game.games import modules as game_paths
            global game_counter
            # Standaartwaarden
            # Aantal spelers dat nodig is voor het spel, standaart 2
            cls.amount_players = 2
            # Maak de class aan
            super().__init__(name, bases, attrs)
            cls.waiting_users = {}
            cls.path = game_paths[game_counter]
            game_counter += 1
            cls.game_info['path'] = cls.path
            url = cls.game_info['url']
            app.add_url_rule(
                '/'+ url,  # URL: https://www.awesome-game.me/naam_spel
                url,       # naam van de pagina
                view_func=cls.http_response,
            )
            namespace = '/'+url
            cls.namespace = namespace
            socketio.on_event('connect', cls.connect_handler, namespace=namespace)
            socketio.on_namespace(WebSocketEvents(namespace))
            socketio.on_event('disconnect', cls.disconnect_handler, namespace=namespace)
        else:
            super().__init__(name, bases, attrs)


class WebSocketEvents(Namespace):
    def on_arrow_press_send(self, message):
        room_id = user_room[request.sid]
        emit('arrow_press', message, room=room_id, include_self=False)
        #room[room_id].arrow_press()
    def on_final_position(self, message):
        room_id = user_room[request.sid]
        emit('final_position', message, room=room_id, include_self=False)
    def on_goal(self, message):
        room_id = user_room[request.sid]
        emit('goal', room=room_id, include_self=False)
        room[room_id].goal(request.sid, message)

class Game_super(metaclass=New_Game):
    '''
        Superklasse voor alle games, met een initiatie en `default methods`
        Deze class wordt in de submappen van `games` als super class gebruikt
        Een inctance van deze class is een `room` waarin elk spel tussen gebruikers wordt geregeld
    '''
    
    @classmethod
    def http_response(cls):
        ''' Render template, maar als de gebruiker niet is ingelogd, stuur hem dan naar de inlogpagina '''
        if not current_user.is_authenticated or not current_user.nickname:
            resp = make_response(redirect(url_for("google.login")))
            resp.set_cookie('redirect_after_login', cls.game_info['url'])
            return resp
        return render_template(
            'game.html',
            game_info = cls.game_info,
        )
    
    @classmethod
    def connect_handler(cls):
        ''' Nieuwe websocket-verbinding '''
        if not current_user.is_authenticated or not current_user.nickname:
            return False
        global room_counter
        global user_room
        global room
        user = {'user_id' : current_user.id, 'nickname' : current_user.nickname}
        cls.waiting_users[request.sid] = user
        if len(cls.waiting_users) == cls.amount_players:
            for ws_id in cls.waiting_users:
                join_room(room_counter, ws_id)
                user_room[ws_id] = room_counter
            # Maak een nieuwe instance aan als 'room'
            #cls.rooms[room_counter] = cls(room_counter, cls.waiting_users)
            room[room_counter] = cls(room_counter, cls.waiting_users)
            cls.waiting_users = {}
            room_counter += 1
        else:
            emit('log', {'status' : 'waiting', 'user' : user}, json=True)
    
    @classmethod
    def disconnect_handler(cls):
        ws_id = request.sid
        if ws_id in cls.waiting_users.keys():
            del(cls.waiting_users[ws_id])
        room_id = user_room.get(request.sid, None)
        if room_id:
            room[room_id].player_left(ws_id)

    @classmethod
    def highscoresTop(cls, n):
        with app.app_context():
            scores = Highscores.query.filter_by(game_id = cls.game_id).order_by("score desc").limit(n)
            return [{
                    'nickname' : User.query.get(row.user_id).nickname,
                    'score'    : "%.1f" % row.score
                } for row in scores]
        
    def __init__(self, room_id, users):
        ''' Alle gebruikers zijn verbonden, het spel moet worden geïnitialiseerd '''
        self.room_id = room_id
        self.users = users
        self.timer = time.time()
        self.links = list(users.keys())[0]
        self.rechts = list(users.keys())[1]
        self.t_laatste_goal = time.time()
        for user in self.users.values():
            user['score'] = 0
            user['punten'] = 0
        emit('log', {
                'status' : 'room_created',
                'room' : room_id,
                'users' : users,
            }, room=room_id)
        emit('room created', {
                'users' : users,
                'links' : self.links,
                'rechts' : self.rechts,
                'random' : random.random(),
            }, json=True, room=room_id)
    
    
    def goal(self, ws_id, message):
        if ws_id == self.rechts:
            player = self.links
        else:
            player = self.rechts
        self.users[player]['score'] += 1
        
        t = time.time()
        dt = t - self.t_laatste_goal
        self.t_laatste_goal = t
        self.users[player]['punten'] += dt**2
        
        score = self.users[player]['score']
        emit('log', {
                'status' : 'goal',
                'player' : self.users[player]['nickname'],
                'score' : score,
                'score_' : message['score'],
            }, json=True, room=self.room_id)
        return score
    
    def game_over(self):
        score = lambda id: self.users[id]['score']
        if score(self.rechts) > score(self.links):
            winner = self.rechts
            winner_n = 1
        elif score(self.links) > score(self.rechts):
            winner = self.links
            winner_n = 0
        else:
            winner = None
            winner_n = -1   
        t = time.time()
        duration = t - self.timer
        sec = duration % 60
        min = (duration - sec) / 60
        dt = t - self.t_laatste_goal
        punten = self.users[winner]['punten'] + dt**2
        n = score(winner) + 1
        punten = punten / n
        user_id = self.users[winner]['user_id']
        if winner:
            with app.app_context():
                row = Highscores.query.get((user_id, self.game_id))
                if row is None:
                    row = Highscores(
                        user_id = user_id,
                        game_id = self.game_id,
                        score = punten,
                    )
                    db.session.add(row)
                elif punten > row.score:
                    row.score = punten
                db.session.commit()
        socketio.emit('game over', {
                'winner'  : winner_n,
                'minutes' : min,
                'seconds' : sec,
                'punten'  : "%.1f" % punten,
            }, namespace=self.namespace, room=self.room_id)
        socketio.emit('log', {
                'status' : 'game over',
                'winner' : winner,
                'minutes' : min,
                'seconds' : sec,
                'score_r' : score(self.rechts),
                'score_l' : score(self.links),
                'punten'  : punten,
            }, namespace=self.namespace, room=self.room_id)
        self.close_room()
    
    def close_room(self):
        print("\n\n Room closed \n\n")
        socketio.emit('log', {
                'status' : 'room closed',
            }, namespace=self.namespace, room=self.room_id)
        for ws_id in self.users.keys():
            if room_counter in rooms(sid = ws_id, namespace=self.namespace):
                leave_room(room_counter, ws_id)
            del user_room[ws_id]
        del room[self.room_id]
        
    def player_left(self, ws_id):
        socketio.emit('log', {
                'status' : 'player_left',
                'player' : self.users[ws_id]
            }, namespace=self.namespace, room=self.room_id)
        self.close_room()