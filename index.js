var JiraApi = require('jira').JiraApi,
    _ = require('lodash');

var globalPickResults = {
    'total': 'total',

    worklogId: {
        keyName: 'worklogs',
        fields: [
            'id'
        ]
    },
    url: {
        keyName: 'worklogs',
        fields: [
            'self'
        ]
    },
    author: {
        keyName: 'worklogs',
        fields: [
            'author.name'
        ]
    },
    comment: {
        keyName: 'worklogs',
        fields: [
            'comment'
        ]
    },
    started: {
        keyName: 'worklogs',
        fields: [
            'started'
        ]
    },
    timeSpent: {
        keyName: 'worklogs',
        fields: [
            'timeSpent'
        ]
    }
};

module.exports = {

    /**
     * Return pick result.
     *
     * @param output
     * @param pickTemplate
     * @returns {*}
     */
    pickResult: function (output, pickTemplate) {
        var result = _.isArray(pickTemplate)? [] : {};
        // map template keys
        _.map(pickTemplate, function (templateValue, templateKey) {

            var outputValueByKey = _.get(output, templateValue.keyName || templateValue, undefined);

            if (_.isUndefined(outputValueByKey)) {

                result = _.isEmpty(result)? undefined : result;
                return;
            }


            // if template key is object - transform, else just save
            if (_.isArray(pickTemplate)) {

                result = outputValueByKey;
            } else if (_.isObject(templateValue)) {
                // if data is array - map and transform, else once transform
                if (_.isArray(outputValueByKey)) {
                    var mapPickArrays = this._mapPickArrays(outputValueByKey, templateKey, templateValue);

                    result = _.isEmpty(result)? mapPickArrays : _.merge(result, mapPickArrays);
                } else {

                    result[templateKey] = this.pickResult(outputValueByKey, templateValue.fields);
                }
            } else {

                _.set(result, templateKey, outputValueByKey);
            }
        }, this);

        return result;
    },

    /**
     * System func for pickResult.
     *
     * @param mapValue
     * @param templateKey
     * @param templateObject
     * @returns {*}
     * @private
     */
    _mapPickArrays: function (mapValue, templateKey, templateObject) {
        var arrayResult = [],
            result = templateKey === '-'? [] : {};

        _.map(mapValue, function (inOutArrayValue) {
            var pickValue = this.pickResult(inOutArrayValue, templateObject.fields);

            if (pickValue !== undefined)
                arrayResult.push(pickValue);
        }, this);

        if (templateKey === '-') {

            result = arrayResult;
        } else {

            result[templateKey] = arrayResult;
        }

        return result;
    },

    /**
     * Return auth object.
     *
     *
     * @param dexter
     * @returns {*}
     */
    authParams: function (dexter) {
        var auth = {
            protocol: dexter.environment('jira_protocol', 'https'),
            host: dexter.environment('jira_host'),
            port: dexter.environment('jira_port', 443),
            user: dexter.environment('jira_user'),
            password: dexter.environment('jira_password'),
            apiVers: dexter.environment('jira_apiVers', '2')
        };

        if (!dexter.environment('jira_host') || !dexter.environment('jira_user') || !dexter.environment('jira_password')) {

            this.fail('A [jira_protocol, jira_port, jira_apiVers, *jira_host, *jira_user, *jira_password] environment has this module (* - required).');

            return false;
        } else {

            return auth;
        }
    },

    /**
     * The main entry point for the Dexter module
     *
     * @param {AppStep} step Accessor for the configuration for the step using this module.  Use step.input('{key}') to retrieve input data.
     * @param {AppData} dexter Container for all data used in this workflow.
     */
    run: function(step, dexter) {

        var issue = step.input('issue').first();

        if (!issue) {

            this.fail('A [issue] input need for this module.');
        }

        var auth = this.authParams(dexter);

        if (!auth)
            return;

        var jira = new JiraApi(auth.protocol, auth.host, auth.port, auth.user, auth.password, auth.apiVers);

        var options = {
            rejectUnauthorized: jira.strictSSL,
            uri: jira.makeUri('/issue/' + issue + '/worklog'),
            method: 'GET',
            json: true
        };

        jira.doRequest(options, function(error, response, body) {

            if (error)
                this.fail(error);

            else if (response.statusCode === 200)
                this.complete(this.pickResult(body, globalPickResults));

            else if (response.statusCode === 404)
                this.fail(response.statusCode + ': Returned if the issue with the given id/key does not exist or if the currently authenticated user does not have permission to view it.');

            else
                this.fail(response.statusCode + ': Something is happened.');

        }.bind(this));
    }
};
