''' Database '''

from awesome_game import app
from flask_sqlalchemy import SQLAlchemy
from flask_dance.consumer.backend.sqla import OAuthConsumerMixin
from flask_login import UserMixin

db = SQLAlchemy(app)

class User(db.Model, UserMixin):
    id = db.Column(db.Integer, primary_key=True)
    nickname = db.Column(db.String(15), unique=True)
    google_id = db.Column(db.String(30), unique=True)

class OAuth(db.Model, OAuthConsumerMixin):
    __tablename__ = "flask_dance_oauth"
    user_id = db.Column(db.Integer, db.ForeignKey(User.id))
    user = db.relationship(User)

class Enabled_games(db.Model):
    game_id = db.Column(db.Integer, primary_key=True)
    directory = db.Column(db.String(20))
    naam_spel = db.Column(db.String(20))

class Highscores(db.Model):
    user_id = db.Column(db.Integer, primary_key=True)
    game_id = db.Column(db.Integer, primary_key=True)
    score = db.Column(db.Integer)
