module.exports = devel = (function () {
    var https = require('https'),
    EE = require('events').EventEmitter,
    helper = require('./helper.js');
    function getGithubInfo (screenName, target) {
        var watcher = target || new EE();
        
        var httpsReq = https.request({
            host : 'api.github.com',
            path : '/users/' + screenName,
            headers : {'Accepted' : 'application/json'}
        });
        httpsReq.on('response', helper.createResponseListener(watcher, 'response'));
        httpsReq.end();

        watcher.on('response', function (e) {
            if ((e.message && e.message === 'Not Found') || !e || !e.login) {
                watcher.emit('err', {error : 'Not Found'});
                return;
            }
            var man = {
                'name' : e.login,
                'occupation' : e.company,
                'synopsis' : (e.email || e.login) + ' [] text',
                'avatar_url' : e.avatar_url,
                'description' : e.bio,
                'misc' : '.SH LOCATION ' +  e.location,
                'see_also' : 'github : ' + e.html_url + ' .PP ' + 'blog : ' + e.blog
            }
            watcher.emit('manready', man);
        });
    }

    return {
        gather : getGithubInfo
    }
})();

var w;
devel.gather('ympbyciouiououio', w = new (require('events').EventEmitter)());
w.on('manready', function (e) {
    console.log(e);
});