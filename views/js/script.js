/* Author: ympbyc
   takes care of the experiment.html and update.html
   retrieve all the nesessary data from the db by requesting the server via ajax
*/

/*
 * function Ym sets some useful methods to the prototype of the object given.
 */
function Ym (obj) {
   // Ym() returns an instance of this Constructor
    var Constructor = function (obj) {
        if (obj)
            for (key in obj)
                if (obj.hasOwnProperty(key))
           this[key] = obj[key]
    }
   // Copy the prototype of the object given to our Ym object's prototype
   // Not sure if this is the right way
    if (obj && obj.prototype) Constructor.prototype = Object.getPrototypeOf(obj);
  
   // Keep the event listener maps
    var listenerStack = []; //for event emitter

   // You know what it does
    Constructor.prototype.each = function (fn) {
        for (key in this) 
            if (this.hasOwnProperty(key))
                fn(this[key], key);
    },

   // Register an event listener
    Constructor.prototype.on = function (ev, listener) {
        listenerStack.push({name : ev, listener : listener});
        return this;
    },
   // Unset an event listener
    Constructor.prototype.off = function (ev, listener) {
        Ym(listenerStack).each(function (item, key) {
            if (item.name === ev) listenerStack[key] = undefined;
        });
        return this;
    },
   // Emit listeners that are listening for this event
    Constructor.prototype.fire = function (ev, obj) {
        obj = obj || {};
        Ym(listenerStack).each(function (item) {
            if (item && item.name == ev) item.listener(obj);
        });
        return this;
    },

   // You know what it does
    Constructor.prototype.map = function (fn) {
        var ret = [];
        this.each(function (item, key) {
            ret.push( fn(item, key) );
        });
        return ret;
    },
   // Return all the keys in this in an array
    Constructor.prototype.keys = function () {
        return this.map(function(item,key){return key})
    },

   // The first argument passed will extend an instance of Ym
   // The second argument passed will extend the prototype of Ym
   // *There should be a better notation
    Constructor.prototype.extend = function (my, proto) {
        var self = this; 
        Ym(my).each(function (item, key) {
            self[key] = item;
        });
        Ym(proto).each(function (item, key) {
            Constructor.prototype[key] = item;
        });
        return this;
    }

    return new Constructor(obj);
}


/*
 * Clients interact with the API through this manualhub object
 */
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
    
    var model = {}; //namespace
    
    model.user = (function () {
        return {
            /* -- get the user's document -- */
            retrieve : function (name, ee) {
                $.getJSON(
                    '/user/'+name,
                    function (json) {
                        ee.fire('response', json);
                    }
                )
            },
            /* -- end -- */

            /*update the user's document */
            update : function (changeSet, ee) {
                $.put(
                    '/user',
                    changeSet,
                    function (err) {ee.fire('response', err);},
                    function (json) {ee.fire('response', json);}
                );
            }
            /* -- end -- */
        };
    })();
    
    /*
     * Helper function evalMan
     * convert nroff formated (subset of it actually) strings to html strings
     */
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
            .replace(/(https*:\/\/.*?)\s/g, '<a href="$1">$1</a>');
    }
    
    var mh = Ym(); // This is the object exposed to htmls
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
                    if (key !== '_id' && key !== '__proto__' && key !== 'updatedAt' && key) {
                        original[key]  = item;
                        e[key] = item && key !== 'avatar_url' ? evalMan(item) : item || '';
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
        updateUser : function (opt) {
            var watcher = Ym();
            //$.put('/user', {changeSet : opt}, function (e) {watcher.fire('response', e)});
            model.user.update({changeSet : opt}, watcher);
            watcher.on('response', function (e) {
                //alert(e);
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