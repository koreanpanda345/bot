const { Client } = require("discord.js");

/**
 * When the client is connected and logged in to Discord
 * @param {Client} client 
 */
module.exports = (client) => {
	console.log(`${client.user.username} is online!`);
	client.user
		.setActivity(`PS Battles in ${client.guilds.cache.size} servers.`, {
			type: "WATCHING",
		})
		.then((presence) =>
			console.log(`Activity set to ${presence.activities[0].name}`)
		)
		.catch(console.error);
}