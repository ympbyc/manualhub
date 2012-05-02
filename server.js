var express = require('express'),
https = require('https'),
url = require('url'),
_ = require('underscore')._,
User = require('./ManualHub.js'),
conf = require('./conf.js');

var DOMAIN = 'localhost',
CLIENT_ID = conf.CLIENT_ID,
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

function createResponseListener (target, eventName) {
    return function (response) {
	var body = "";
	response.on('data', function (chunk) {
	    body += chunk;
	});
	response.on('end', function () {
	    console.log(body);
	    var ev = JSON.parse(body);
	    target.emit(eventName, ev);
	});
    }
}

app.get('/', function (req, res){
    //res.end(JSON.stringify(req.session) || '{}');
    res.redirect('/manualhub');
});

app.get('/auth/github', function (req, res) {
    req.session.redirect_uri = url.parse(req.url, true).query.redirect_uri;
    res.redirect('https://github.com/login/oauth/authorize?client_id='+CLIENT_ID+'&scope=gist,user&redirect_uri=http://s7.rs2.gehirn.jp:8080/auth/github/callback');
});

app.get('/auth/github/callback', function (req, res) {
    var reqBody = ('client_id='+CLIENT_ID+'&client_secret='+CLIENT_SECRET+'&code='+url.parse(req.url, true).query.code);;
    var request = https.request(
        {
	    host : GITHUB,
	    method : 'POST', 
            path : '/login/oauth/access_token?'+reqBody,
	    headers : { 'Accept' : 'application/json' }
	}
    );
    request.on('response', createResponseListener(request, 'login'));
    request.on('login',  function (e) {
	if (e.error) res.end(e.error);
	else {
	    req.session.github = {};
	    req.session.github.token = e.access_token;
	    //req.session.redirect_uri = undefined;
	    req.emit('authDone');
	}
    });
    request.write('');
    request.end();

    req.on('authDone', function () {
	var request = https.get({
	    host : GITHUBAPI,
	    path : '/user?access_token='+req.session.github.token,
	    headers : {'Accepted' : 'application/json'}
	});
	request.on('response', createResponseListener(request, 'parse'));
	request.on('parse', function (e) {
	    console.log(e);
	    req.session.github.id = e.id;
	    req.session.github.name = e.login;
	    req.session.github.avatar_url = e.avatar_url;
	    User.findOne({github_id : e.id}, function (err, doc) {
		if (!err && doc) res.redirect(req.session.redirect_uri || '/');
		if (!err && !doc) {
		    var user = new User(); //mongoose model User
		    user.github_id = e.id,
		    user.name = e.login,
		    user.avatar_url = e.avatar_url;
		    user.save(function (err) {
			if (err) res.send(err);
			else res.redirect(req.session.redirect_uri || '/');
		    });
		}
	    });
	    setTimeout(function () {res.end('timeout')}, 5000); //this fires when the server is not connected to the  db
	});
    });
});

app.get('/user/:name', function (req, res) {
    User.findOne({name : req.params.name, }, function (err, doc) {
	if (!err && doc) {
	    req.emit('gotDoc', doc);
	    res.end(JSON.stringify(doc));
	}else res.send({"error" : "user "+req.params.name+" does not exist"})
    });
});

app.put('/user', function (req, res) {
    if (!(req.session && req.session.github && req.session.github.id)) { res.send(400); return;}
    function validate (v) {
	return v.length > 0 && v.length < 2000 && !(v.match(/[|]|{|}|<|>|&|;|"|`|=/));
    }
    var change = {};
    _(req.body.changeSet).each(function (item,key) {
	if (key === 'name' || key === 'github_id' || key === '_id') return;
	else if (!validate(item)) return;
	else change[key] = item;
    });
    change.updatedAt = new Date().getTime();
    console.log(change);
    var conditions = {github_id : req.session.github.id},
    update = {$set : change},
    options = {};
    console.log(update);
    User.update(conditions, update, options, function (err) {
	if (err) throw err;
	else res.end('{success : 1}');
    });
});

app.get('/me', function (req, res) {
    if (!req.session || !req.session.github || !req.session.github.id) {
	res.redirect('/auth/github?redirect_uri=/me');
	return;
    }
    User.findOne({github_id : req.session.github.id}, function (err, doc) {
	if (!err && doc) res.render('update.html');
    });
});


app.get('/whoami', function (req, res) {
    if (!!req.session && !!req.session.github) res.end(JSON.stringify({
	name : req.session.github.name
    }));
    else res.end('{name : "noone""}');
});

app.get('/dl', function (req, res) {
    var u = url.parse(req.url, true);
    res.writeHead({'Content-Type' : 'text/plain'});
    res.end(u.query.man.replace(/___/g, '\n'));
});

app.get('/recent', function (req, res) {
    User.find({}).limit(20).sort("updatedAt", -1).execFind(function (err, docs) {
	res.writeHead({'Content-Type' : 'application/json'});
	res.end(JSON.stringify(docs || err));
    })
});

app.get('/:userName', function (req, res) {
    res.render('experiment.html');
});

app.listen(8080);
