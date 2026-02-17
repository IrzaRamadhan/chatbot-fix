module.exports = async (m, { isOwner, reply }) => {
    if (isOwner) {
        return reply("U are my dear boss 😘");
    } else {
        return reply("MEHH, GET THE F OUT OF HERE 😤");
    }
};

module.exports.command = ['whome'];
module.exports.tags = ['owner'];
module.exports.help = ['whome'];
