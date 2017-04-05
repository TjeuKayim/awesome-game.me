''' ================= Login met Google ========================= '''
from awesome_game import app
from flask import redirect, request
from .database import db, OAuth, User
from flask_login import current_user, LoginManager, login_user, login_required, logout_user
from flask_dance.consumer.backend.sqla import SQLAlchemyBackend
from flask_dance.contrib.google import make_google_blueprint, google

# Flask-login
login_manager = LoginManager()
login_manager.init_app(app)
@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

@app.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect("/")

# Login met Google (flask-dance)
app.secret_key = "93voi34-xo5ic"
blueprint = make_google_blueprint(
    client_id = "218856565967-ndgfec1s8f43s5971t791qjn8997uunv.apps.googleusercontent.com",
    client_secret = "G87A_jX7cfYdh4zb1DUAv09Z",
    #scope = ["profile", "email"]
    scope = ["profile"]
)
app.register_blueprint(blueprint, url_prefix="/login")
blueprint.backend = SQLAlchemyBackend(OAuth, db.session, user=current_user)

from flask_dance.consumer import oauth_authorized
from sqlalchemy.orm.exc import NoResultFound

@oauth_authorized.connect_via(blueprint)
def google_logged_in(blueprint, token):
    if not token:
        flash("Failed to log in with {name}".format(name=blueprint.name))
        return
    resp = google.get("/plus/v1/people/me")
    assert resp.ok, resp.text
    google_id = resp.json()["id"]
    query = User.query.filter_by(google_id=google_id)
    try:
        user = query.one()
    except NoResultFound:
        # Maak een nieuwe gebruiker aan
        user = User(google_id=google_id)
        db.session.add(user)
        db.session.commit()
    login_user(user,remember=True)

@app.route('/kies-nickname', methods=['POST'])
def kies_nickname():
    if current_user.is_authenticated and not current_user.nickname:
        nickname = request.form['nickname'][:20]
        validation = nickname_validation(nickname)
        try:
            request.form['validate']
        except KeyError:
            pass
        else:
            return validation
        if validation != 'Valid':
            return validation
        user = User.query.get(current_user.get_id())
        user.nickname = nickname
        db.session.commit()
        return redirect("/")
    else:
        return "Error"
    
def nickname_validation(nickname):
    # nickname moet 3 tot 20 letters bevatten
    if len(nickname) < 3:
        return "Gebruik meer dan 3 letters"
    # nickname mag niet beginnen met een spatie, of eindigen met een spatie
    if nickname[:1] == ' ' or nickname[-1:] == ' ':
        return "Een nickname mag niet beginnen of eindigen met een spatie"
    if User.query.filter_by(nickname=nickname).first() != None:
        return "Sorry, deze nickname is al in gebruik"
    return "Valid"