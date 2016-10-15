var express = require('express'),
    connect = require('connect'),
    fs = require ('fs'),
    shortid = require('shortid'),
    xkcdPassword = require('xkcd-password'),
    compression = require('compression'),
    nodemailer = require('nodemailer'),
    credentials = require('./credentials.js'),
    sqlite3 = require('sqlite3').verbose(),
    https = require('https'),
    http = require('http');

// Begin Express
var app = express();
app.use(compression());

// Error Checks
var newGroupError = false,
    newLinkError = false,
    validEmail = true,
    editCollection = false;

// Set up page id options
var longId = new xkcdPassword(),
    idOptions = {
        numWords: 3,
        minLength: 3,
        maxLength: 8,
        separator: '_'
    };

// set up sqlite3 database
var file = "master.db";
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

// Set up nodemailer
var mailTransport = nodemailer.createTransport('SMTP',{
    service: 'Hotmail',
    auth: {
        user: credentials.MAIL_USER,
        pass: credentials.MAIL_PASS,
    }
});

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

app.get('/', function(req, res){
    longId.generate(idOptions, function(err, result){
        res.render('home', { pageid: result.join('_'), newsite: true });
    });
});

app.get('/examples', function(req, res) {
    res.render('examples');
});

app.get('/faqs', function(req, res) {
    res.render('faqs');
});

app.get('/:pageid', function(req, res, next){
    
    var context = {};
    var pageId = req.params.pageid;
    var collectionURL = req.protocol + '://' + req.hostname + '/' + req.params.pageid;
    var groups = [];
    var groupIds = [];

    db.serialize(function() {
        db.all("SELECT sessionid, title, desc FROM session WHERE sessionpage = (?)", pageId, function(err, rows){
            if (rows) {
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
                var stmt = "SELECT linkid, title, url, linksession FROM link WHERE linksession IN (\'" + groupIds.join('\',\'') + "\')";
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
                                        url: rows[k].url,
                                        linkid: rows[k].linkid,
                                    };
                                    groups[j].links.push(link);
                                }
                            }
                        }
                        context = renderHomeContext(groups, pageId, collectionURL);
                        res.render('home', context);
                    } else {
                        context = renderHomeContext(groups, pageId, collectionURL);
                        res.render('home', context);
                    }
                });
            } else {
                res.render('home', { pageid: pageId });
            }
        });
    });
});

app.post('/:pageid/editcollection', function(req, res){
    if (req.body.editsdone === "false") {
        editCollection = true;
    }
    res.redirect(303, '/' + req.params.pageid)
});

app.post('/:pageid/newsession', function(req, res){

    var newSessionId = shortid.generate();

    var rowPageId = req.params.pageid;

    var validTitle = /\S/.test(req.body.grouptitle);

    if (!validTitle) {
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

    var newLinkId = shortid.generate();
    var newLinkURL;

    var validURL = /\S/.test(req.body.newlinkurl);
    var validHTTP = /^[hH][tT][tT][pP][sS]*\:\/\//.test(req.body.newlinkurl);

    var emptyTitle = /\s*/.test(req.body.newlinktitle);

    if (!validHTTP) {
        newLinkURL = "http://" + req.body.newlinkurl;
    } else {
        newLinkURL = req.body.newlinkurl;
    }

    if (!validURL) {
        newLinkError = true;
        res.redirect(303, '/' + req.params.pageid);
    } else {
        db.serialize(function() {

            if (emptyTitle) {
                getPageTitle(res, req.params.pageid, newLinkId, newLinkURL, req.params.sessionid);
            } else {
                db.run("INSERT INTO link VALUES (?, ?, ?, ?)", [ newLinkId, req.body.newlinktitle, newLinkURL, req.params.sessionid ]);
                res.redirect(303, '/' + req.params.pageid + '#' + req.params.sessionid);
            }
            
        });

    }

});

app.post('/:pageid/:sessionid/deletegroup', function(req, res){
    
    db.serialize(function() {
        db.run("DELETE FROM link WHERE linksession = (?)", [ req.params.sessionid ], function(err) {
            db.run("DELETE FROM session WHERE sessionid = (?)", [ req.params.sessionid ], function(err) {
                editCollection = true;
                res.redirect(303, '/' + req.params.pageid);
            });
        })
    });

});

app.post('/:pageid/:sessionid/deletelink', function(req, res){
    db.serialize(function() {
        db.run("DELETE FROM link WHERE linkid = (?) AND linksession = (?)", [ req.body.linkdelid, req.params.sessionid ], function(err) {
            editCollection = true;
            res.redirect(303, '/' + req.params.pageid);
        });
    });
    
})

app.post('/:pageid/sendlink', function(req, res){

    var emailString = req.body.emails;
    var lastCommaPos = 0;
    var i = 0;

    while (validEmail && i < emailString.length) {
        if (emailString.charAt(i) === ',') {
            validEmail = /@/.test(emailString.substring(lastCommaPos, i));
            lastCommaPos = i;
        }
        i++;
    }

    if (!validEmail) {
        res.redirect(303, '/' + req.params.pageid); 
    } else {
        mailTransport.sendMail({
            from: '"Linkage - DO NOT REPLY" <do-not-reply@linkage.io>',
            to: emailString,
            subject: 'Linkage URL - Access the collection!',
            text: req.protocol + '://' + req.hostname + '/' + req.params.pageid
        }, function(err){
            if (err) {
                console.error ( 'Unable to send email: ' + err );
                validEmail = false;
            }
            res.redirect(303, '/' + req.params.pageid);
        });
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

function renderHomeContext(groups, pageId, collectionURL){

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

    var context = {
        groupcolumns: groupColumns,
        pageid: pageId,
        collectionurl: collectionURL,
    };

    if (newGroupError) {
        context.newgrouperror = newGroupError;
        newGroupError = false;
    }

    if (newLinkError) {
        context.newlinkerror = newLinkError;
        newLinkError = false;
    }

    if (!validEmail) {
        context.emailerror = true;
        validEmail = true;
    }

    if (editCollection) {
        context.editcollection = true;
        context.editcollectiontext = "Done Editing";
        editCollection = false;
    } else {
        context.editcollectiontext = "Edit Collection";
    }

    return context;
}

function getPageTitle(mainRes, pageID, linkID, url, sessionID){
    
    var urlRegex = /[\S]*\.[\w]*[^\/\s]/i,
        urlArray = urlRegex.exec(url),
        pathRegex = /(?:[\w])(\/[\S]*)/i,
        pathArray = pathRegex.exec(url);

    var siteTitleRegex = /\<title>([\s\S]*)\<\/title>/,
        siteTitleArray = [],
        siteTitle = '',
        data = [];

    var options = {
        host: JSON.stringify(urlArray[0]),
        path: JSON.stringify(pathArray[1]),
        method: 'GET',
    };
    try {
        http.get(url, function(res){
            res.on('data', function(chunk) {
                data.push(chunk);
            }).on('end', function(){
                data = Buffer.concat(data).toString();
                siteTitleArray = siteTitleRegex.exec(data);
                siteTitle = siteTitleArray[1];
                db.run("INSERT INTO link VALUES (?, ?, ?, ?)", [ linkID, siteTitle, url, sessionID ]);
                mainRes.redirect(303, '/' + pageID + '#' + sessionID);
            });
        }).end();
    } catch (error) {
        try {
            https.get(url, function(res){
                res.on('data', function(chunk) {
                    data.push(chunk);
                }).on('end', function(){
                    data = Buffer.concat(data).toString();
                    siteTitleArray = siteTitleRegex.exec(data);
                    siteTitle = siteTitleArray[1];
                    db.run("INSERT INTO link VALUES (?, ?, ?, ?)", [ linkID, siteTitle, url, sessionID ]);
                    mainRes.redirect(303, '/' + pageID + '#' + sessionID);
                });
            }).end();
        } catch (error) {
            db.run("INSERT INTO link VALUES (?, ?, ?, ?)", [ linkID, siteTitle, url, sessionID ]);
            mainRes.redirect(303, '/' + pageID + '#' + sessionID);
        }
    }

}