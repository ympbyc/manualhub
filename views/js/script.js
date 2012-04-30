/* Author: ympbyc
   takes care of the index.html
   retrieve all the nesessary data from the db by requesting the server via ajax
*/

function Ym (obj) {
    obj = obj || {};
    obj.prototype = obj.prototype || {};
    var listenerStack = []; //for event emitter
    return _(obj.prototype).extend({
	on : function (ev, listener) {
	    listenerStack.push({name : ev, listener : listener});
	    },
	off : function (ev, listener) {
	    _(listenerStack).each(function (item, key) {
		if (item.name === ev) listenerStack[key] = undefined;
	    });
	},
	fire : function (ev, obj) {
		obj = obj || {};
	    _(listenerStack).each(function (item) {
		if (item.name == ev) item.listener(obj);
	    });
	},
	validate : function (required, optional) {
	    var ret = Ym();
	    var self = obj;
	    _(required).each(function (item) {
                    if (self[item]) ret[item] = self[item];
                else throw 'required field ' + item + ' is not set';
	    });
	    _(optional).each(function(_default, field) {
                ret[field] = self[field] || _default;
	    });
	    return ret;
	}
    })
}

var manualhub = (function main () {
    if (!(window.jQuery && window._)) 
	setTimeout(main, 100);
    
    $.extend({
	"put" : function (url, data, success, error) {
	    error = error || function() {}; 
	    return $.ajax({
		"url" : url,
		"data" : data,
		"success" : success,
		"type" : "PUT",
		"cache" : false,
		"error" : error,
		"dataType" : "json"
	    });
	}
    });
    
    var HOST = 'http://localhost:8080';

    var model = {};
    model.user = (function () {
	return {
	    retrieve : function (name, ee) {
		$.getJSON(
		    HOST+'/user/'+name,
		    function (json) {
			ee.fire('response', json);
		    }
		)
	    },
	    update : function (name, changeSet, ee) {
		$.put(
		    HOST+'/user/'+name,
		    changeSet,
		    function (json) {ee.fire('response', json);},
		    function (err) {throw err}
		);
	    }
	};
    })();

    function evalMan (text) {
        return text
	    .replace(/$/, ' ')
	    .replace(/\n/g, ' ')
	    .replace(/.PP/g, '<br />')
            .replace(/\.br/g, '<br />')
            .replace(/\.B\s(.*?)\s/g, '<strong>$1</strong>')
            .replace(/\.I\s(.*?)\s/g, '<em>$1</em>')
            .replace(/\.SH\s(.*?)\s/g, '%%<h1 class="man-sh">$1</h1>&&')
            .replace(/&&(.*?)(%%|$)/g, '<div class="man_content">$1</div>')
            .replace(/(%%|&&)/g, '')
	    .replace(/(http:\/\/.*?)\s/g, '<a href="$1">$1</a>');
    }

    var mh = Ym();
    return _(mh).extend({
	showUser : function (name) {
	    watcher = Ym(),
	    user = (!!name) ? name : 'manualhub';
	    model.user.retrieve(user, watcher);
	    
	    watcher.on('response', function (e) {
		if (e.error) {location.href = '/'; return;}
		window.__manualhubResult = e;
		var original = {};
		_(e).each(function (item, key) {
		    if (key !== '_id' && key !== '__proto__' && key !== 'updatedAt') {
			original[key]  = item;
			e[key] = evalMan(item);
		    }
		});
		$('#man_thumbnail').html('<img src="'+e.avatar_url+'" alt="" />');
		$('#man_name').html(['<strong>',e.name,'</strong>',' - ','<spanp id="man_occupation" class="editable direct">',
				     e.occupation || '.....', '</span>'].join(''));
		$('#man_synopsis').html(e.synopsis);
		$('#man_description').html(e.description);
		$('#man_misc').html(e.misc);
		$('#man_see_also').html(e.see_also);
		$('h2.man-th').html(e.name.toUpperCase()+'(1)');
		mh.fire('shown', original);
	    });
	},
	/*createUser : function (opt) {
	    var data = Ym(opt).validate(
		['description', 'occupation', 'synopsis'], 
		{twitter : '', see_also : [], misc : []}
	    );
	    $.post('/user', data, function (e) {data.fire('response', e)});
	    data.on('response', function (e) {
		alert(e);
	    });
	},*/
	updateUser : function (opt) {
	    var watcher = Ym();
	    $.put('/user', {changeSet : opt}, function (e) {watcher.fire('response', e)});
	    watcher.on('response', function (e) {
		alert(e);
	    });
	},
	evalMan : evalMan,
	dlMan : function (original) {
	    var man = '';
	    _(original).each(function (text, key) {
		original[key] = text.replace(/(\..+?\s.*?\s)/g, '___$1___');
	    });
	    man = ['.\\" Save this page as ~/man/manl/foo.l',
		   '.\\" Then hit the following command',
		   '.\\" man -M ~/man foo______',
		   '.TH ' + original.name.toUpperCase() + ' 1',
		   '.SH NAME',
		   original.name + ' \- ' + original.occupation,
		   '.SH SYNOPSIS',
		   original.synopsis,
		   '.SH DESCRIPTION',
		   original.description,
		   original.misc,
		   '.SH SEE ALSO',
		   original.see_also].join('___');
	    location.href = '/dl?man=' + man;
	}
    })
})();