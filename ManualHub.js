var mongoose = require('mongoose'),
mongoDbUri = process.env.MONGOLAB_URI || 'mongodb://localhost:27017/manualhub';
db = mongoose.connect(mongoDbUri, function (err) {
  if (err) console.error(err);
});

Schema = mongoose.Schema;

/* -- validators -- */
function hundred (v) {
    return !v || (v.length <= 20 && v.length > 0 && !(v.match(/<|>|&|"|;|alert/)));
}
function twothousand (v) {
    return !v || (v.length <= 2000 && v.length > 0 && !(v.match(/<|>|&|"|;|alert/)));
}
/* -- end --*/

User = new Schema({
    github_id : {type : String, validate : [hundred, "if this ever happens, mention me on twitter @ympbyc as soon as f*in' possible"]},
    name : {type : String, validate : [hundred, "ah... have you ever heared of 'googlability'?"]},
    description : {type : String, validate : [twothousand, "description field can only contain upto 2000 charactors"]},
    avatar_url : {type : String, validate : [twothousand, "blame gravater. they make the url too long"]},
    occupation : {type : String, validate : [hundred, "consider migrating some bits to description field"]},
    synopsis : {type : String, validate : [twothousand, "you are probablly misunderstanding the role of this field"]},
    twitter : {type : String, validate : [hundred, "you are not serious are you?"]},
    see_also : {type : String, validate : [twothousand, "manualhub doesn't promote SEO"]},
    misc : {type : String, validate : [twothousand, "exceeded the limit of 2000 charactors"]}
});

User.pre('save', function (next) {
    if (this.isNew) {
        next();
    }
    else {throw 'user already exists'; return;}
    next();
});

mongoose.model('User', User);

module.exports = db.model('User');
