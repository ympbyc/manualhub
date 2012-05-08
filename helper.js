/*
 * helper function createResponseListener
 * used when using http.request()
 * The function returned will listen for incoming data from the remote server
 * and merges all those data. 
 * When the response is complete, it'll fire an event('eventName') at the target ('target')
 */
module.exports.createResponseListener = function (target, eventName) {
    return function (response) {
        var body = "";
        response.on('data', function (chunk) {
            body += chunk;
        });
        response.on('end', function () {
            var ev = JSON.parse(body);
            target.emit(eventName, ev);
        });
    }
}

/*
 * Helper function setCommonHeader
 * takes an response object as an argument
 * and sets neccessary headers then return it. All the exposed API endpoints
 * such as PUT /user, GET /user/:name will use this function.
 */
module.exports.setCommonHeader = function (res) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Headers', 'x-prototype-version,x-requested-with');
    res.setHeader('Access-Control-Allow-Origin', '*');
    return res;
}