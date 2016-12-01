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

// Global Vars
var urlHostRegex = /[hH][tT][tT][pP][sS]*\:\/\//g;

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

    //   server.close();
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

//Create new link group
app.post('/:pageid/newsession', function(req, res){

    var newGroupId = shortid.generate(),
        rowPageId = req.params.pageid
        newGroupTitle = req.body.grouptitle,
        newGroupDesc = req.body.groupdesc;

    var validTitle = /\S/g.test(req.body.grouptitle);

    if (!validTitle) {
        newGroupError = true;
        if(req.xhr || req.accepts('json,html') === 'json') {
            res.send({ error: 'Group Title is required' });
        } else {
            res.redirect(303, '/' + rowPageId);
        }
    } else {
        db.serialize(function() {

            db.get("SELECT pageid FROM page WHERE pageid = (?)", [req.params.pageid], function(err, row){
                if (row) {
                    db.run("INSERT INTO session VALUES (?, ?, ?, ?)", [ newGroupId, newGroupTitle, newGroupDesc, rowPageId ], function(err){
                        sqliteErrCheck(err, 'INSERT', 'session');
                        if (req.xhr || req.accepts('json,html') === 'json') {
                            res.send({ groupid: newGroupId, 
                                       pageid: rowPageId,
                                       grouptitle: newGroupTitle,
                                       groupdesc: newGroupDesc });
                        } else {
                            res.redirect(303, '/' + rowPageId);
                        }
                    });
                } else {
                    db.serialize(function() {
                        db.run("INSERT INTO page VALUES (?, ?)", [ rowPageId, req.url ], function(err) {
                            sqliteErrCheck(err, 'INSERT', 'page');
                        });
                        db.run("INSERT INTO session VALUES (?, ?, ?, ?)", [ newGroupId, newGroupTitle, newGroupDesc, rowPageId ], function(err){
                            sqliteErrCheck(err, 'INSERT', 'session');
                            res.redirect(303, '/' + rowPageId);
                        });
                    });
                }
            });
        });
    }
});

//Add new link
app.post('/:pageid/:sessionid/addlink', function(req, res){

    var newLinkId = shortid.generate();
    var newLinkURL;

    req.body.newlinkurl.replace(/\s/g,'');
    var validURL = /\S/g.test(req.body.newlinkurl);
    var validHTTP = urlHostRegex.test(req.body.newlinkurl);

    var hasTitle = /[\S]/g.test(req.body.newlinktitle);

    if (!validHTTP) {
        newLinkURL = "http://" + req.body.newlinkurl;
    } else {
        newLinkURL = req.body.newlinkurl;
    }

    if (!validURL) {
        newLinkError = true;
        if(req.xhr || req.accepts('json,html') === 'json') {
            newLinkError = false;
            res.send({ error: 'URL is required' });
        } else {
            res.redirect(303, '/' + req.params.pageid);
        }
    } else {
        db.serialize(function() {
            if (!hasTitle) {
                getPageTitle(res, req.params.pageid, newLinkId, newLinkURL, req.params.sessionid);
            } else {
                db.run("INSERT INTO link VALUES (?, ?, ?, ?)", [ newLinkId, req.body.newlinktitle, newLinkURL, req.params.sessionid ]);
                if (req.xhr || req.accepts('json,html') === 'json') {
                    // if(err) {
                    //     res.send({ error: 'Error inserting new link' });
                    // } else {
                    res.send({ newURL: newLinkURL, newLinkTitle: req.body.newlinktitle, newLinkId: newLinkId });
                    // }
                } else {
                    res.redirect(303, '/' + req.params.pageid + '#' + req.params.sessionid);
                }
            }
            
        });

    }

});

//Delete link group
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

//Delete link from group
app.post('/:pageid/:sessionid/deletelink', function(req, res){
    db.serialize(function() {
        db.run("DELETE FROM link WHERE linkid = (?) AND linksession = (?)", [ req.body.linkdelid, req.params.sessionid ], function(err) {
            editCollection = true;
            if (req.xhr || req.accepts('json,html') === 'json') {
                // if(err) {
                //     res.send({ error: 'Error inserting new link' });
                // } else {
                res.send({ error: false, });
            } else {
                res.redirect(303, '/' + req.params.pageid);
            }
        });
    });
    
})

//Email page link
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

    context.pageredirected = true;

    return context;
}

function getPageTitle(mainRes, pageID, linkID, url, sessionID){
    console.log('in url: ' + url);
    var urlArray = urlHostRegex.exec(url);

    console.log(urlArray);

    var urlHost = urlArray[0],
        urlPath = url.substring(urlHost.length); 

    var siteTitleRegex = /\<title>([\s\S]*)\<\/title>/,
        siteTitleArray = [],
        siteTitle = '',
        data = [];

    var options = {
        host: urlHost,
        path: urlPath,
        method: 'GET',
    };

    try {
        var responseErr;
        http.get(url, function(res){
            console.log('response: ' + res.statusCode);
            if(res.statusCode == 301) {
                responseErr = true;;
            } else {
                res.on('data', function(chunk) {
                    data.push(chunk); 
                }).on('end', function(){
                    data = Buffer.concat(data).toString();
                    console.log('data: ' + data);
                    siteTitleArray = siteTitleRegex.exec(data);
                    siteTitle = siteTitleArray[1];
                    db.run("INSERT INTO link VALUES (?, ?, ?, ?)", [ linkID, siteTitle, url, sessionID ]);
                    mainRes.redirect(303, '/' + pageID + '#' + sessionID);
                });
            }
        }).end();
        if (responseErr) {
            console.log('throwing error');
            throw responseErr;
        }
    } catch (error) {
        console.log('caught error');
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