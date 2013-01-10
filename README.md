# RequestRunner

A simple script to run a series of test requests.  Useful as a test harness that can execute multiple
sequential or asynchronous HTTP requests and display or log the responses

* Version : 0.0.1
* Author  : Brendan Gawn
* Contact : brendang@ssimicro.com

## Config File

A config file for RequestRunner contains a JSON representation of an object with these attributes:

* uri   : common part of the uri used in all requests not marked `absoluteuri`
* loop  : number of times to loop over the list(s) of requests
* log   : relative path to a file for log output
* goldlog : relative path to a file containing expected log output. NOT IMPLEMENTED
* timeout : default request timeout value in ms
* dynamic : true to generate groups and tests in javascript code, false to use a static list defined in the config file

## Instantiating

Example:

    // read command-line args, first of which we will take as config file name
    var cmdlineArgs = process.argv.splice(2);

    var cfgFileName = cmdlineArgs[0]; // crash if none supplied

    // create new object including config filename
    var myconfig = {
        config: cfgFileName
    };

    // create RequestRunner object, which will run all the requests
    // callback is called with error object if any error happened
    // otherwise it is called with nothing once all tests are complete
    var runner = new require('RequestRunner')(myconfig, function(err){
        if (err) {
            console.log(err);
            process.exit(1);
        } else {
            process.exit(0);
        }
    });

## Use with a Static Config File

To use a static list of tests, add these elements to the JSON object described above:

    groups: {
        serial : true to execute groups serially, false to execute asynchronously
        list : [ JSON array of group objects as
               { name : name of the group
                 serial : true to execute tests within the group serially, false to execute asynchronously
                 requests :[ array of JSON objects as:
                           { enable : nonzero (true) to enable this test
                             method : http method (GET, PUT, POST, DELETE, OPTIONS ect)
                             uri    : add this string to common uri unless absoluteuri is true, in which case replace it
                             testid : optional string id of the test, sequential numbering used otherwise
                             json   : true have the request to accept application/json, or false
                             body   : JSON request body
                }]
        }]
    disabletestgroups : [ array of integers - the indices of test groups which should be disabled]

See `tests.config.sample` for an example static script.


## Generating requests dynamically

RequestRunner can also use request data that is runtime-generated, allowing you to add systematic request patterns
or random elements into the test approach.

* Start with a simple config file something like this (notice this one has no groups or request lists in it,
unlike the static example referred to above):

<pre>
    {
        "uri": "http://mysite.com/route/of/interest",
        "log" : "./test.log",
        "timeout": 500,
        "dynamic" : true
    }
</pre>

* add some javascript functions that will be called in  place of or in addition to built-in functionality
<pre>

    var myconfig = { config: cfgFileName,
                    prepareOptions: myPrepOptions,
                    prepareRequest: myPrepFunc,
                    onResponse: myOnResponse
    };
</pre>

* `prepareOptions()` : do anything you want to the options data as read from the file,
  before we start running the requests.  called once only.  In the dynamic case, 
  we might want to add the groups object (including its list of groups and each group's 
  list of requests)

* `prepareRequest(request_data)` : do anything you want to the request data before we execute it

* `onResponse(error, reqData, response, body)` : called whebn the response to a given request is
  received.  The error object is null unless an error happened.  reqData is the data we used to 
  initiate the request. error, response, body are as received thru node.request  


