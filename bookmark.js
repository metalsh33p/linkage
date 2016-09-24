var express = require('express'),
    connect = require('connect'),
    fs = require ('fs'),
    shortid = require('shortid'),
    xkcdPassword = require('xkcd-password'),
    compression = require('compression'),
    sqlite3 = require('sqlite3').verbose();

// Error Checks
var newGroupError = false;
var newLinkError = false;

var app = express();

app.use(compression());

// set up handlebars view engine
var handlebars = require('express-handlebars').create({
  defaultLayout:'main',
  helpers: {
    section: function(name, options){
      if(!this._sections) this._sections = {};
      this._sections[name] = options.fn(this);
      return null;
    }
  }
});

// set up sqlite3 database
var file = "master.db";
console.log('starting database');
var db = new sqlite3.Database(file);
db.serialize(function(){
    db.run("PRAGMA foreign_keys = true", function(err) {
        sqliteErrCheck(err, 'SET', 'PRAGMA');
    });
    db.run("CREATE TABLE IF NOT EXISTS page (pageid TEXT PRIMARY KEY, pageurl TEXT)", function(err) {
        sqliteErrCheck(err, 'CREATE', 'page');
    });
    db.run("CREATE TABLE IF NOT EXISTS session (sessionid TEXT PRIMARY KEY, title TEXT, desc TEXT, sessionpage TEXT, FOREIGN KEY(sessionpage) REFERENCES page (pageid) )", function(err) {
        sqliteErrCheck(err, 'CREATE', 'session');
    });
    db.run("CREATE TABLE IF NOT EXISTS link (linkid TEXT PRIMARY KEY, title TEXT, url TEXT, linksession TEXT, FOREIGN KEY(linksession) REFERENCES session (sessionid) )", function(err) {
        sqliteErrCheck(err, 'CREATE', 'link');
    });
});

app.engine('handlebars', handlebars.engine);
app.set('view engine', 'handlebars');

app.set('port', process.env.PORT || 3000);

// Set up domains for error handling
app.use(function(req, res, next){
  var domain = require('domain').create();

  domain.on('error', function(err){
    console.error('DOMAIN ERROR CAUGHT\n', err.stack);
    try{
      setTimeout(function(){
        console.error('Failsafe shutdown.');
        process.exit(1);

      }, 5000);

      var worker = require('cluster').worker;
      if(worker) worker.disconnect();

      server.close();
      db.close();

      try {
        next(err);
      } catch(err) {
        console.error('Express error mechanism failed.\n', err.stack);
        res.statusCode = 500;
        res.setHeader('content-type', 'text/plain');
        res.end('Server error.');
      }
    } catch(err) {
      console.log('Unable to send 500 response.\n', err.stack);
    }
  });

  domain.add(req);
  domain.add(res);
  domain.run(next);

});

app.use(express.static(__dirname + '/public'));

app.use(require('body-parser').urlencoded({ extended: true }));

// Set up MongoDB connection
var opts = {
  server: {
    socketOptions: { keepAlive: 1 }
  }
};

app.get('/', function(req, res){
    var longId = new xkcdPassword();
    var idOptions = {
        numWords: 3,
        minLength: 3,
        maxLength: 8,
        separator: '_'
    };
    longId.generate(idOptions, function(err, result){
        console.log('pageid: ' + result.join('_'));
        res.render('home', { pageid: result.join('_'), newsite: true });
    });
});

app.get('/:pageid', function(req, res){
    console.log('in get pageid');
    var context = {};
    var pageId = req.params.pageid;
    var groups = [];
    var groupIds = [];

    db.serialize(function() {
        db.all("SELECT sessionid, title, desc FROM session WHERE sessionpage = (?)", pageId, function(err, rows){
            if (rows) {
                console.log('rows found');
                for(var i = 0; i < rows.length; i++) {
                    var group = {
                        title: rows[i].title,
                        description: rows[i].desc,
                        id: rows[i].sessionid,
                        links: []
                    };
                    groupIds.push(group.id);
                    groups.push(group);
                }
                var stmt = "SELECT title, url, linksession FROM link WHERE linksession IN (\'" + groupIds.join('\',\'') + "\')";
                db.all(stmt, function(err, rows){
                    if(rows) {
                        for(var j = 0; j < groups.length; j++) {
                            for(var k = 0; k < rows.length; k++) {
                                if (groups[j].id === rows[k].linksession) {
                                    var linkTitle;
                                    if (rows[k].title) {
                                        linkTitle = rows[k].title;
                                    } else {
                                        linkTitle = rows[k].url;
                                    }
                                    var link = {
                                        title: linkTitle,
                                        url: rows[k].url
                                    };
                                    groups[j].links.push(link);
                                }
                            }
                        }
                        context = renderHomeContext(groups, pageId);
                        res.render('home', context);
                    } else {
                        context = renderHomeContext(groups, pageId);
                        res.render('home', context);
                    }
                });
            } else {
                res.render('home', { pageid: pageId });
            }
        });
    });
});

app.post('/:pageid/newsession', function(req, res){

    console.log('starting new session route');

    // var sessions = []; Can delete?

    var newSessionId = shortid.generate();

    var rowPageId = req.params.pageid;
    console.log(JSON.stringify(req.body, null, 4));

    if (!req.body.grouptitle) {
        newGroupError = true;
        res.redirect(303, '/' + rowPageId);
    } else {
        db.serialize(function() {

            db.get("SELECT pageid FROM page WHERE pageid = (?)", [req.params.pageid], function(err, row){
                if (row) {
                    db.run("INSERT INTO session VALUES (?, ?, ?, ?)", [ newSessionId, req.body.grouptitle, req.body.groupdesc, rowPageId ], function(err){
                        sqliteErrCheck(err, 'INSERT', 'session');
                        res.redirect(303, '/' + rowPageId);
                    });
                } else {
                    db.serialize(function() {
                        db.run("INSERT INTO page VALUES (?, ?)", [ rowPageId, req.url ], function(err) {
                            sqliteErrCheck(err, 'INSERT', 'page');
                        });
                        db.run("INSERT INTO session VALUES (?, ?, ?, ?)", [ newSessionId, req.body.grouptitle, req.body.groupdesc, rowPageId ], function(err){
                            sqliteErrCheck(err, 'INSERT', 'session');
                            res.redirect(303, '/' + rowPageId);
                        });
                    });
                }
            });
        });
    }
});

app.post('/:pageid/:sessionid/addlink', function(req, res){

    // var sessions = []; Can delete?

    var newLinkId = shortid.generate();

    var validURL = /\S/.test(req.body.newlinkurl);
    var validHTTP = /^[hH][tT][tT][pP][sS]*\:\/\//.test(req.body.newlinkurl);

    if (!validURL) {
        newLinkError = true;
        res.redirect(303, '/' + req.params.pageid);
    } else {
        if (!validHTTP) {
            console.log('INVALID HTTP');
            req.body.newlinkurl = "http://" + req.body.newlinkurl;
        }

        db.serialize(function() {

            db.run("INSERT INTO link VALUES (?, ?, ?, ?)", [ newLinkId, req.body.newlinktitle, req.body.newlinkurl, req.params.sessionid ]);

        });

        res.redirect(303, '/' + req.params.pageid);
    }

});

// custom 404 page
app.use(function(req, res){
  res.status(404);
  res.render('404');
});

// custom 500 page
app.use(function(err, req, res, next){
  console.error(err.stack);
  res.status(500);
  res.render('500');
});

function startServer() {
	var server = app.listen(app.get('port'), function(){
		console.log( 'Express started in ' + app.get('env') + ' mode on http://localhost:' + app.get('port') + '; press Crtl-C to terminate.');
	});
}

if(require.main === module){
	// application run directly; start app startServer
	startServer();
} else {
	//application imported as a module via "require": export function to create server
	module.exports = startServer();
}

function sqliteErrCheck(err, tableAction, tableName){
    if(err){
        console.log('Error when performing ' + tableAction + ' on table: ' + tableName);
        console.log(err);
    }
}

function renderHomeContext(groups, pageId){

    // var rowCount = 0;
    var columnOne = [];
    var columnTwo = [];
    var columnThree = [];
    var colSelector = 0;

    for (var i = 0; i < groups.length; i++) {
        switch (colSelector) {
            case 0:
                columnOne.push(groups[i]);
                colSelector++;
                break;

            case 1:
                columnTwo.push(groups[i]);
                colSelector++;
                break;

            case 2:
                columnThree.push(groups[i]);
                colSelector = 0;
                break;
        }
    }

    var groupColumns = [columnOne, columnTwo, columnThree];

    console.log(groupColumns);

    var context = {
        groupcolumns: groupColumns,
        pageid: pageId,
    };

    if (newGroupError) {
        context.newgrouperror = newGroupError;
        newGroupError = false;
    }

    if (newLinkError) {
        context.newlinkerror = newLinkError;
        newLinkError = false;
    }

    return context;
}
