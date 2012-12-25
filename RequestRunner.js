// *******************
// required node modules
// *******************
var request = require('request')
    , http = require('http')
    , path = require('path')
    , fs = require('fs') ;



function RequestRunner(options, callback) {

    var m_testCount = 0;

    // *******************
    // mainline
    // *******************
    initOptions(options, function(err){
        if (err){
            callback(err);
        } else {
            initLogging(function(err){
                if (err){
                    callback(err);
                } else {

                    writeToTestlog("Test Run: " + new Date());

                    mainLine(function(err){
                        if (err){
                            callback(err);

                        }

                    });
                }
            });

        }
    });

    // *******************
    // config file / object : JSON
    // *******************
    function initOptions(options, callback){

        options = options || {};

        try {

            if (!options.config){
                callback(new Error("missing config specification"));
            } else {
                if (fs.existsSync(options.config)) {
                    global.config = JSON.parse(fs.readFileSync(options.config));
                    global.config.timeout = global.config.timeout || 1000;
                    callback();
                } else {
                    callback(new Error("missing or invalid config specification"));
                }
            }

        } catch(e) {
            callback(e); // consumer terminates
        }
    }

    function prepareTest(testData, gid, tt)
    {
        testData.groupId = gid;
        // copy it before modding - is there a better / another way??
        var test = JSON.parse(JSON.stringify(testData));

        if (!test.absoluteuri){
            if (test.uri) {
                // cannot use path.join here: sometimes we want ? instead of /
                test.uri = global.config.uri + test.uri;
            } else {
                // default route
                test.uri = global.config.uri;
            }

        }

        // autogenerate an id
        var tid = testData.groupId + tt;
        if (test.testid) {
            test.testid =  tid + " (" + test.testid + ")";
        } else {
            test.testid = tid;
        }

        return test;
    }

    function execGroup(group, callback)
    {
        try {


            if (group.disabled){
                writeToTestlog(group.groupid + " " + group.name + " : disabled");

            } else if (group.serial){
                writeToTestlog(group.groupid + " " + group.name + " : serial");
                function execSeries(testData) {
                    if(testData) {
                        var test = prepareTest(testData, group.groupid, group.requests.length+1);

                        doRequest( test, function(err, testid){
                            if (err){
                                callback(err);
                            } else {
                                // completed, or timeout
                                //results.push(testid);
                                return execSeries(group.requests.shift());
                            }
                        } );
                    } else {
                        // last one done.
                        callback();
                    }
                }

                // kickstart the series
                execSeries(group.requests.shift());

            } else {
                writeToTestlog(group.groupid + " " + group.name + " : asynch");
                // straight-up series start, asynch ends
                for (var tt = 0; tt < group.requests.length; tt++) {

                    doRequest( prepareTest(group.requests[tt], group.groupid, tt), callback);

                }
            }
        } catch (exc) {

            callback(exc);  // consumer terminates
        }
    }

    function prepareGroup(group, num)
    {
        // group id
        group.groupid = (num+1)*100;

        // disable selected groups
        if (global.config.disabletestgroups){
            for (var dd = 0; dd < global.config.disabletestgroups.length; dd++){
                if (aa == global.config.disabletestgroups[dd]){
                    group.disabled = true;
                }
            }
        }
    }
    function mainLine(callback){
        try {

            if (!global.config || !global.config.groups || !global.config.groups.list) {
                callback("invalid config data");
                return;
            }

            for (var aa = 0; aa < global.config.groups.list.length; aa++) {
                prepareGroup(global.config.groups.list[aa], aa)
            }

            for (var ii = 0; ii < global.config.loop; ii++) {

                // count how many tests
                for (var aa = 0; aa < global.config.groups.list.length; aa++) {
                    m_testCount += global.config.groups.list[aa].requests.length;
                }

                if (global.config.groups.serial){

                    function execGroupSeries(group) {
                        if(group) {

                            execGroup( group, function(err){
                                if (err){
                                    callback(err);
                                } else {
                                    // completed, or timeout
                                    execGroupSeries(global.config.groups.list.shift());
                                }
                            } );
                        } else {
                            // done
                            callback();
                        }
                    }

                    // kickstart the series
                    execGroupSeries(global.config.groups.list.shift());

                } else {

                    for (var aa = 0; aa < global.config.groups.list.length; aa++) {


                        if (global.config.groups.list[aa].disabled){
                            writeToTestlog("Test Group " + gid + " is disabled.");
                            m_testCount -= alltests[aa].length;
                        } else {

                            // groups have to be made to run (complete) in order.
                            // tests within groups are NOT guaranteed to execute to completion in order
                            execGroup( global.config.groups.list[aa], callback );

                        }
                    }
                }
            }
        } catch (exc) {

            callback(exc);  // consumer terminates
        }

    }


    // *******************
    // infrastructure
    // *******************
    function doRequest( reqData, callback){

        asynchReq(reqData, function(error, response, body){

            writeToTestlog("==============================");
            writeToTestlog("Test: " + JSON.stringify(reqData));

            logResponse(error, response, body);


            writeToTestlog("completed test " + reqData.testid);

            callback(null, reqData.testid);

        });
    }

    function asynchReq(reqData, callback)
    {
        if (reqData.enable == false || reqData.enable == 0) {
            writeToTestlog("Disabled test: " + JSON.stringify(reqData));
            callback();
        } else {
            writeToTestlog("Starting test: " + reqData.testid);
            request( reqData, callback );

        }
    }

    function logResponse(error, response, body){

        if (error) {
            writeToTestlog(error);
        } else {
            if (response) {
                writeToTestlog("response status: " + response.statusCode );
                if (response.statusText) writeToTestlog("response status: " + response.statusText);
            }
            if (body){
                if (isEmpty(body)){
                    writeToTestlog("{}");
                } else if (isObject(body)){
                    writeToTestlog(body);
                } else if (Array.isArray(JSON.parse(body))){
                    var arr = JSON.parse(body);
                    for (var aa = 0; aa < arr.length; aa++){
                        writeToTestlog(arr[aa]);
                    }

                } else {
                    writeToTestlog(body);
                }

            }
        }

    }


    // test for object
    function isObject(object) {
        if (object.constructor == Object) {
            return true;
        }
        return false;
    }

    // test for empty object
    function isEmpty(object) {
        for (var i in object) {
            return false;
        }
        return true;
    }

    function writeToTestlog(str){

        console.log(str);

        // echo to output file
        logMessage(str);
    }

    function initLogging(callback){
        // open (create or truncate)  the result file, and close it again
        try {
            if (global.config.log) {
                fs.open(global.config.log, 'w', function(err, fd){
                    if(err || !fd) {
                        callback(err);
                    } else {
                        fs.closeSync(fd);
                        callback();
                    }
                });
            } else {
                callback();
            }
        } catch (exc) {
            callback(exc);
        }
    }

    function logMessage(str){
        // open the result file, append to it, and close it again
        try {
            if (global.config.log) {
                str =  str + "\n";
                fs.appendFileSync(global.config.log, str);
            }
        } catch (exc) {
            console.log (exc);
        }
    }
}

module.exports = RequestRunner;

