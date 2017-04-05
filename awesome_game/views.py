''' ========================= Webpagina's ======================== '''
from awesome_game import app, Games
from flask import render_template, redirect, url_for, request, make_response, send_from_directory
from flask_login import current_user

@app.route("/")
def home():
    cookie = request.cookies.get('redirect_after_login')
    if cookie and current_user.is_authenticated and current_user.nickname:
        resp = make_response(redirect(cookie))
        resp.set_cookie('redirect_after_login', '', expires=0)
        return resp
    return render_template('home.html', Games = Games)

@app.route("/verantwoording")
def verantwoording():
    return render_template('verantwoording.html')
  
@app.route("/highscores")
def highscores():
    return render_template(
        'Highscore.html',
        Games = Games
    )

@app.route("/team")
def team():
    return render_template('Team.html')

# Static files (alleen om te testen, NGINX doet dit normaal gesproken)
#@app.route('/static/<path:path>')
#def send_js(path):
#    return send_from_directory('static', path)

@app.route('/games/<path:path>')
def send_js(path):
    return send_from_directory('games', path)
