const express = require('express');
const PORT = process.env.PORT || 5000;
const mongoose = require('mongoose');
const flash = require('connect-flash');
const session = require('express-session');
const passport = require('passport');

const app = express();
const server = require('http').createServer(app)
const io = require('socket.io')(server);
server.listen(3000)

const bodyParser = require('body-parser');
const fileUpload = require('express-fileupload');
const cors = require('cors');

const User = require("./Models/User");
const path = require("path");
const {ensureAuthenticated, admin} = require("./config/auth");
const Game = require("./Models/Game");
const Message = require("./Models/Message");
const db = require('./config/keys').mongoURI;

io.on('connection', (socket) => {
    Message.find().then(result => {
        socket.emit('output-messages', result)
    })
    console.log('a user connected');
    socket.emit('message', 'Hello world');
    socket.on('disconnect', () => {
        console.log('user disconnected');
    });
    socket.on('chatmessage', msg => {
        console.log('msg')
        const message = new Message({ text:msg });
        message.save().then(() => {
            io.emit('message', msg)
        })


    })
});




require('./config/passport')(passport);

mongoose.connect(db).then(()=>console.log('mongodb connected')).catch(err => console.log(err));

app.set('view engine', 'ejs');

app.use('/static',express.static(__dirname + '/uploads'))

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(fileUpload({ createParentPath: true}));
app.use('/upload',express.static(path.join(__dirname, 'uploads')));

app.use(session({
    secret: 'adil',
    resave: true,
    saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.session(), (req, res, next)=>{
    res.locals.message = req.session.message
    delete req.session.message
    next()
});

app.use(flash(), (req, res, next)=>{
    res.locals.success_msg = req.flash('success_msg');
    res.locals.error_msg = req.flash('error_msg');
    res.locals.success = req.flash('error');
    next();
});

app.use('/', require('./routes/index'));
app.use('/users', require('./routes/users'));
app.use('/games', require('./routes/games'));
app.use('/message', require('./routes/messages'));


app.get('/upload/:name', ensureAuthenticated, (req,res)=>{
    res.render('upload',{
        user:req.user
    })
})

app.post('/upload/:name', ensureAuthenticated, async(req, res) => {
    try {
        if(!req.files) {
            res.send({
                status: false,
                message: 'No file uploaded'
            });
        } else {
            let avatar = req.files.avatar;

            await avatar.mv('./uploads/' + avatar.name);
            const user = req.user
            const name = req.params.name

            User.findOneAndUpdate({name:name}, {$set: {avatar:avatar.name}},
                (err) => {
                    if (err){
                        throw err;
                    } else {
                        if(req.path === '/upload/'+user.name){res.redirect('/profile2')}
                        else{res.redirect('/users')}

                    }
                })
        }
    } catch (err) {
        res.status(500).send(err);
    }
});

function authRole(role){
    return (req,res,next)=>{
    if (req.user.role !== role) {
        res.render('main', {
            user:req.user
        });
    }
    next()
}}

app.get('/users/nameSort',ensureAuthenticated, authRole(1), async function (req, res) {
    let users = await User.find().sort({ name : 1});
    res.render('users', {
        user: req.user,
        users: users
    });
});

app.get('/users/citySort',ensureAuthenticated, authRole(1), async function (req, res) {
    let users = await User.find().sort( { city : 1} );
    res.render('users', {
        user: req.user,
        users: users
    });
});

app.get('/users/',ensureAuthenticated, authRole(1), async function (req, res) {
    let users = await User.find();
    res.render('users', {
        user: req.user,
        users: users
    });
});

app.get('/profile/delete/:name', authRole(1),ensureAuthenticated, async (req, res) => {
    let name = req.params.name;
    await User.findOneAndDelete({name: name});
    console.log(name + " is deleted")
    res.redirect('/users')
})

app.get('/aboutUs', ensureAuthenticated, (req,res)=>{
    res.render('abus',{
        user:req.user
    })
})

app.get('/games/upload/:name',ensureAuthenticated, (req,res)=>{
    let name = req.params.name;
    Game.findOne({name: name}, (err, docs) => {
        console.log(docs)
        res.render('uploadgame', {
            game: docs,
            user: req.user
        })
    })
})

app.post('/games/upload/:name', ensureAuthenticated, async (req, res) => {
    try {
        if (!req.files) {
            res.send({
                status: false,
                message: 'No file uploaded'
            });
        } else {
            let avatar = req.files.avatar;

            await avatar.mv('./uploads/' + avatar.name);
            const name = req.params.name

            Game.findOneAndUpdate({name: name}, {$set: {avatar: avatar.name}},
                (err) => {
                    if (err) {
                        throw err;
                    } else {
                        res.redirect('/games/show/'+name)
                    }
                })
        }
    } catch (err) {
        res.status(500).send(err);
    }
})


