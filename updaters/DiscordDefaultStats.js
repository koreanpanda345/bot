const util = require("../utils.js");

class DiscordDefaultStats {
	constructor(message) {
		//Requires that message is a Discord Message object
		this.message = message;
		this.channel = this.message.channel;
		this.server = this.message.guild;
	}

	async update(matchJson) {
		let info = matchJson.info;
		let messages = info.csv ? util.genCSV(matchJson) : util.genMessage(matchJson);
		let psPlayer1 = Object.keys(matchJson.players)[0];
		let psPlayer2 = Object.keys(matchJson.players)[1];
		let message1 = messages[0];
		let message2 = messages[1];

		//finally sending players the info
		if (info.spoiler) {
			this.channel.send(
				`||**${psPlayer1}**: \n${message1}|| \n\n||**${psPlayer2}**: \n${message2}|| \n\n**Replay: **${info.replay}\n**History: **${info.history}`
			);
		}
		else {
			this.channel.send(
				`**${psPlayer1}**: \n${message1} \n\n**${psPlayer2}**: \n${message2} \n\n**Replay: **${info.replay}\n**History: **${info.history}`
			);
		}
	}
}

module.exports =  DiscordDefaultStats;
