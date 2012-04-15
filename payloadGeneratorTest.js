var assert = require("assert");
var PayloadGenerator = require("./payloadGenerator");
var pg = new PayloadGenerator();

module.exports = {

    "test missing value" : function() {
        var subs = { "BAR": "bar" };
        var text = pg.transform("@@FOO@@ @@BAR@@", subs);
        assert.equal(text, " bar");
    },

    "test default value" : function() {
        var subs = { "BAR": "bar" };
        var text = pg.transform("@@FOO=123@@ @@BAR@@", subs);
        assert.equal(text, "123 bar");
    },

    "test subs" : function() {
        var subs = { "FOO": "foo", "BAR": "bar" };
        var text = pg.transform("@@FOO@@ @@BAR@@", subs);
        assert.equal(text, "foo bar");
    }
};

if (typeof module !== "undefined" && module === require.main) {
    require("asyncjs").test.testcase(module.exports).exec();
}
