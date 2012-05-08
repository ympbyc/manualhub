/*
 * server.js
 * Author: ympbyc, yano3
 */

/*
 * We set headers explicitly and use res.write() and res.end()
 * instead of res.send().
 */

var express = require('express'),
https = require('https'),
url = require('url'),
_ = require('underscore')._,
User = require('./ManualHub.js'),
conf = require('./conf.js'),
helper = require('./helper.js'),
gather = require('./gatherMan.js');


var HOST = 'http://manualhub.herokuapp.com'
PORT = '8080',
CLIENT_ID= conf.CLIENT_ID,
CLIENT_SECRET = conf.CLIENT_SECRET,
GITHUB = 'github.com',
GITHUBAPI = 'api.github.com';

var app = express.createServer();
app.configure(function () {
    app.use(express.logger());
    app.use(express.bodyParser());
    app.use(express.cookieParser());
    app.use(express.session({ secret : '大室櫻子' }));
    app.use(app.router);
    app.use(express.static(__dirname + '/views'));
    app.set('views', __dirname + '/views');
    // disable layout
    app.set("view options", {layout: false});
    // make a custom html template
    app.register('.html', {
        compile: function(str, options){
            return function(locals){
                return str;
            };
        }
    });
});

app.dynamicHelpers({
    session : function (req, res) {
        return req.session;
    }
});

/*
 * UI
 */
app.get('/', function (req, res){
    //res.end(JSON.stringify(req.session) || '{}');
    res.redirect('/manualhub');
});

/*
 * API
 * redirects users to github's OAuth prompt
 */
app.get('/auth/github', function (req, res) {
    var host = 'http://' + req.header('host');
    req.session.redirect_uri = url.parse(req.url, true).query.redirect_uri;
    res.redirect('https://github.com/login/oauth/authorize?client_id='+CLIENT_ID+'&scope=&redirect_uri=' + host + '/auth/github/callback');
});


/*
 * API
 * Users will be redirected back to this URL.
 * Github returns an temporary token which can be exchanged with an access token, so we do that here.
 * After acquiring the token, we re-request github for additional user information that can be used
 * when creating a document(in MongoDB) for the user.
 * If this is the first time the user logged in, we create his document here. 
 * Otherwise he will be redirected back to session.redirect_uri immidiately.
 */
app.get('/auth/github/callback', function (req, res) {
    /* -- request github for an access token -- */
    var reqBody = ('client_id='+CLIENT_ID+'&client_secret='+CLIENT_SECRET+'&code='+url.parse(req.url, true).query.code);;
    var request = https.request({
        host : GITHUB,
        method : 'POST', 
        path : '/login/oauth/access_token?'+reqBody,
        headers : { 'Accept' : 'application/json' }
    });
    request.on('response', helper.createResponseListener(request, 'login'));
    request.on('login',  function (e) {
        if (e.error) res.end(JSON.stringify(e.error));
        else {
            req.session.github = {};
            req.session.github.token = e.access_token;
            req.emit('authDone');
        }
    });
    request.write(''); //since this is a POST req, we need to write something in the body
    request.end();
    /* -- end -- */

    req.on('authDone', function () {
        /* -- request for user info (e.g. name, avatar_url) -- */
        var request = https.get({
            host : GITHUBAPI,
            path : '/user?access_token='+req.session.github.token,
            headers : {'Accepted' : 'application/json'}
        });
        request.on('response', helper.createResponseListener(request, 'parse'));
        /* -- end --*/

        /*
         * Now we set the user's session
         * and if he is a new-commer create a mongo document for him.
         */
        request.on('parse', function (e) {
            console.log(e);
            req.session.github.id = e.id;
            req.session.github.name = e.login;
            req.session.github.avatar_url = e.avatar_url;
            
            /* -- if the user doesn't exist on db, create one now -- */
            User.findOne({github_id : e.id}, function (err, doc) {
                if (!err && doc) {res.redirect(req.session.redirect_uri || '/'); return}
                if (!err && !doc) {
                    var user = new User(); //mongoose model User
                    user.github_id = e.id,
                    user.name = e.login,
                    user.avatar_url = e.avatar_url;
                    user.description = e.bio;
                    user.save(function (err) {
                        if (err) res.end(JSON.stringify(err));
                        else res.redirect(req.session.redirect_uri || '/');
                    });
                }
            });
            /* -- end -- */

            setTimeout(function () {res.end('timeout')}, 5000); //this fires when the server is not connected to the  db
        });
        /* -- end -- */
    });
});

/*
 * API
 * GET user/:name returns the document of the user specified by the name parameter.
 * The format of JSON is {name : ..., github_id : ...} etc. (not in an array)
 *
 * if the user is not on manualhub yet, fetch his bio at github and display it.
 */
app.get('/user/:name', function (req, res) {
    res = helper.setCommonHeader(res);
    User.findOne({name : req.params.name, }, function (err, doc) {
        if (!err && doc) {
            var doc = JSON.stringify(doc);
            res.setHeader('Content-Length', Buffer.byteLength(doc, 'utf8'));
            res.end(doc);
        } else {
            gather.gather(req.params.name, req);
            req.on('manready', function (man) {
                var doc = JSON.stringify(man);
                res.setHeader('Content-Length', Buffer.byteLength(doc, 'utf8'));
                res.end(doc);
            });
            req.on('err', function () {
                var err = JSON.stringify({"error" : "user "+req.params.name+" does not exist"});
                res.setHeader('Content-Length', Buffer.byteLength(err, 'utf8'));
                res.end(err);
            });
        }
    });
});

/*
 * API
 * Updates the authenithicated users document.
 * Since mongoose doesn't validate the content passed to Model.update
 * we have to do it ourselves.
 */
app.put('/user', function (req, res) {
    if (!(req.session && req.session.github && req.session.github.id)) { res.send(401); return;} //unauthorized

    res = helper.setCommonHeader(res);

    function validate (v) {
        /* Argument must be a string and have the length of less than 2000.
         * A simple xss validation will also be performed */
        return v.length > 0 && v.length < 2000 && !(v.match(/[|]|{|}|<|>|&|;|"|`|=/));
    }
    var change = {}; //fields of a document that are gonna change
    _(req.body.changeSet).each(function (item,key) {
        if (key === 'name' || key === 'github_id' || key === '_id') return; //we don't want them changed
        else if (!validate(item)) return; //validation error
        else change[key] = item;  //all the rest
    });
    change.updatedAt = new Date().getTime();
    console.log(change);
    var conditions = {github_id : req.session.github.id},
        update = {$set : change},
        options = {};
    User.update(conditions, update, options, function (err) {
        if (err) {
            var err = JSON.stringify(err);
            res.setHeader('Content-Length', Buffer.byteLength(err, 'utf8'));
            res.end(err);
        }
        else {
            res.setHeader('Content-Length', 13);
            res.end('{success : 1}');
        }
    });
});

/*
 * UI
 * The html this function returns (update.html) will hit PUT /user
 */
app.get('/me', function (req, res) {
    /* if not logged in, redirect users to login flow  */
    if (!req.session || !req.session.github || !req.session.github.id) {
        res.redirect("/auth/github?redirect_uri=/me");
        "/" //シンタックスハイライタのバグ避け
        return;
    }

    /* if the user exists in the DB (always true), return the html  */
    User.findOne({github_id : req.session.github.id}, function (err, doc) {
        if (!err && doc) res.render('update.html');
    });
});

/*
 * API
 * GET whoami returns the name of the authenithicated user
 */
app.get('/whoami', function (req, res) {
    res = helper.setCommonHeader(res);

    if (!!req.session && !!req.session.github) {
        var json = JSON.stringify({
            name : req.session.github.name
        });
        res.setHeader('Content-Length', Buffer.byteLength(json, 'utf8'));
        res.end(json);
    }
    else {
        res.setHeader('Content-Length', 17);
        res.end('{name : "noone""}');
    }
});

/*
 * UI
 */
app.get('/dl', function (req, res) {
    var u = url.parse(req.url, true);
    var man = u.query.man.replace(/___/g, '\n');
    res.writeHead({
        'Content-Type' : 'text/plain',
        'Content-Length' : Buffer.byteLength(man, 'utf8')
    });
    res.end(man);
});

/*
 * API
 * returns upto 20 most recently updated documents
 */
app.get('/recent', function (req, res) {
    User.find({}).limit(20).sort("updatedAt", -1).execFind(function (err, docs) {
        var json = JSON.stringify((docs || err))
        res.setHeader('Content-Length', Buffer.byteLength(json, 'utf8'));
        res.end(json);
    })
});

/*
 * UI
 * The html this function returns will hit GET /user
 * and render the user's info on the DOM
 */
app.get('/:userName', function (req, res) {
    res.render('experiment.html');
});

/* Listen for requests */
var port = process.env.PORT || PORT;
app.listen(port, function(){
    console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);
});

