//actual bot goes here
const Discord = require("discord.js");
const Airtable = require("airtable");
const getUrls = require("get-urls");
const Showdown = require("./tracker/Showdown");
const util = require("./utils.js");

//Getting config info
const { token, airtable_key, base_id } = require("./config.json");
//Creating the bot
const bot = new Discord.Client({ disableEveryone: true });

//When the bot is connected and logged in to Discord
bot.on("ready", async () => {
	console.log(`${bot.user.username} is online!`);
	bot.user.setActivity(`PS battles in ${bot.guilds.size} servers`, { type: "watching" });
});

const base = new Airtable({
	apiKey: airtable_key,
}).base(base_id);

//When a message is sent
bot.on("message", async (message) => {
	let channel = message.channel;
	let channels = await util.getChannels();

	if (message.author.bot) return;

	let msgStr = message.content;
	let msgParams = msgStr.split(" ").slice(3).join(" "); //["porygon,", "use", "command", ...params]
	let prefix = "porygon, use";

	if (channel.type === "dm") return;
	else if (
		channel.name.includes("live-links") ||
		channel.name.includes("live-battles")
	) {
		//Extracting battlelink from the message
		let urls = getUrls(msgStr).values(); //This is because getUrls returns a Set
		let battlelink = urls.next().value;
		if (battlelink && !battlelink.includes("google")) {
			let psServer = "";
			//Checking what server the battlelink is from
			if (battlelink.includes("sports.psim.us")) {
				psServer = "Sports";
			} else if (battlelink.includes("automatthic.psim.us")) {
				psServer = "Automatthic";
			} else if (battlelink.includes("play.pokemonshowdown.com")) {
				psServer = "Showdown";
			} else if (battlelink.includes("dawn.psim.us")) {
				psServer = "Dawn";
			} else {
				channel.send(
					"This link is not a valid Pokemon Showdown battle url."
				);
				return;
			}

			channel.send("Joining the battle...");
			//Instantiating the Showdown client
			const psclient = new Showdown(battlelink, psServer, message);
			//Tracking the battle
			let battleInfo = await new Promise(async (resolve, reject) => {
				resolve(await psclient.track());
			}).then(() => {
				console.log("Tracking done!");
			});
		}
	}

	if (msgStr.toLowerCase().startsWith(`${prefix} help`)) {
		let helpEmbed = new Discord.RichEmbed()
			.setTitle("Porygon Commands")
			.setDescription(`Prefix: ${prefix} _______`)
			.setThumbnail(bicon)
			.setColor(0xffc0cb)
			.addField(
				'help [optional: "commands"]',
				"How to use the bot, and lists the commands it has."
			)
			.addField(
				"setup",
				"The setup command for servers who are new to Porygon. You have to send this command in the live links channel you want to use for the league you are setting up"
			)
			.addField(
				"add [Showdown name] --r=[Range to be updated on Sheet]",
				'Adds a player to the database of the league whose live links channel the command is sent in. If the "--r=" field is provided, it updates the range of the player\'s stats in the Google Sheet as well.'
			)
			.addField(
				"remove [Showdown name]",
				"Removes a player from the database of the league whose live links channel the command is sent in."
			)
			.addField(
				"edit [old Showdown name] --nn=[new Showdown name] --r=[optional Sheet range]",
				"Edits the given player's Showdown name and, optionally, the player's Sheet range."
			)
			.addField(
				"list",
				"Lists the players of the league whose live links channel the command is sent in."
			)
			.addField(
				"clear",
				"Clears the list of players of the league whose live links channel the command is sent in. This command cannot be undone."
			)
			.addField(
				"mode",
				"Help command for editing the mode in your server."
			);

		return channel.send(helpEmbed);
	} else if (msgStr.toLowerCase().startsWith(`${prefix} add`)) {
		if (!message.member.hasPermission("MANAGE_ROLES")) {
			return channel.send(
				":x: You're not a moderator. Ask a moderator to add this person for you."
			);
		}
		if (!channels.includes(channel.id)) {
			return channel.send(
				":x: This is not a valid live-links channel. Try this command again in the proper channel."
			);
		}

		//Getting info from the command
		const rangeParams = msgParams.split(" --r=");
		let player = rangeParams[0];
		let range = rangeParams[1] ? rangeParams[1].split("--")[0] : "";

		//Finding the league that the player is going to get added to
		let leagueJson = await util.findLeagueId(channel.id);
		let leagueRecordId = leagueJson.id;
		let leagueName = leagueJson.name;
		let playersIds = await util.getPlayersIds(leagueRecordId);

		//Checking if league is empty
		let finalMessage = await channel.send(
			"Verifying league in the database..."
		);
		if (playersIds !== []) {
			//Checking if the player is already in the league's database
			let funcarr = [];
			let isIn = false;
			for (let playerId of playersIds) {
				funcarr.push(
					new Promise((resolve, reject) => {
						base("Players").find(playerId, async (err, record) => {
							if (err) reject(err);

							let recordName = await record.get("Showdown Name");
							if (
								recordName.toLowerCase() ===
								player.toLowerCase()
							) {
								isIn = true;
							}

							resolve();
						});
					})
				);
			}
			await Promise.all(funcarr);
			if (isIn) {
				return await finalMessage.edit(
					`${player} is already in this league's database!`
				);
			}
		}

		//Creates a new record for the player
		await base("Players").create([
			{
				fields: {
					"Showdown Name": player,
					Leagues: [leagueRecordId],
					Range: range,
				},
			},
		]);

		console.log(`${player} has been added to ${leagueName}!`);
		return await finalMessage.edit(
			`\`${player}\` has been added to \`${leagueName}\`!`
		);
	} else if (msgStr.toLowerCase().startsWith(`${prefix} remove`)) {
		if (!message.member.hasPermission("MANAGE_ROLES")) {
			return channel.send(
				":x: You're not a moderator. Ask a moderator to remove this person for you."
			);
		}
		if (!channels.includes(channel.id)) {
			return channel.send(
				":x: This is not a valid live-links channel. Try this command again in the proper channel."
			);
		}

		//Finding the league that the player is going to get added to
		let player = msgParams;
		let leagueJson = await util.findLeagueId(channel.id);
		let leagueRecordId = leagueJson.id;
		let leagueName = leagueJson.name;
		let playersIds = await util.getPlayersIds(leagueRecordId);

		//Checking if the player is already in the database
		let finalMessage = await channel.send(
			"Verifying league in the database..."
		);
		let funcarr = [];
		let isIn = false;
		let realPlayerId;
		for (let playerId of playersIds) {
			funcarr.push(
				new Promise((resolve, reject) => {
					base("Players").find(playerId, async (err, record) => {
						if (err) reject(err);

						let recordName = await record.get("Showdown Name");
						if (recordName.toLowerCase() === player.toLowerCase()) {
							isIn = true;
							realPlayerId = playerId;
						}

						resolve();
					});
				})
			);
		}
		await Promise.all(funcarr);
		if (!isIn) {
			return await finalMessage.edit(
				`${player} is not in this league's database!`
			);
		}

		//Creates a new record for the player
		await base("Players").destroy([realPlayerId], (err, deletedRecords) => {
			if (err) console.error(err);
		});

		console.log(`${player} has been removed from ${leagueName}!`);
		return await finalMessage.edit(
			`\`${player}\` has been removed from \`${leagueName}\`!`
		);
	} else if (msgStr.toLowerCase().startsWith(`${prefix} edit`)) {
		if (!message.member.hasPermission("MANAGE_ROLES")) {
			return channel.send(
				":x: You're not a moderator. Ask a moderator to edit this person for you."
			);
		}
		if (!channels.includes(channel.id)) {
			return channel.send(
				":x: This is not a valid live-links channel. Try this command again in the proper channel."
			);
		}

		// Getting info from the command
		let oldName;
		let newName;
		let range;
		if (msgParams.includes("--nn=") && msgParams.includes("--r=")) {
			// Both are given
			let nnParams = msgParams.split(" --nn=");
			oldName = nnParams[0];
			let rParams = nnParams[1].split(" --r=");
			newName = rParams[0];
			range = rParams[1];
		} else if (msgParams.includes("--nn=")) {
			let nnParams = msgParams.split(" --nn=");
			oldName = nnParams[0];
			newName = nnParams[1];
			range = "None";
		} else if (msgParams.includes("--r=")) {
			let rParams = msgParams.split(" --r=");
			oldName = rParams[0];
			newName = oldName;
			range = rParams[1];
		}

		//Updates the record in the database
		//Finding the league that the player is going to get edited in
		let leagueJson = await util.findLeagueId(channel.id);
		let leagueRecordId = leagueJson.id;
		let leagueName = leagueJson.name;
		let playersIds = await util.getPlayersIds(leagueRecordId);

		//Finding the player's recordId
		let funcarr = [];
		let recordId = "";
		for (let playerId of playersIds) {
			funcarr.push(
				new Promise((resolve, reject) => {
					base("Players").find(playerId, async (err, record) => {
						if (err) reject(err);

						let recordName = await record.get("Showdown Name");
						if (
							recordName.toLowerCase() === oldName.toLowerCase()
						) {
							recordId = playerId;
						}

						resolve();
					});
				})
			);
		}
		await Promise.all(funcarr);
		//Editing the record
		base("Players").update([
			{
				id: recordId,
				fields: {
					"Showdown Name": newName,
					Range: range,
				},
			},
		]);

		//Edited!
		console.log(
			`Edited ${oldName} to become ${newName} in ${leagueName} with ${range} range.`
		);
		message.channel.send(
			`Edited \`${oldName}\` to become \`${newName}\` in \`${leagueName}\ with \`${range}\` range!`
		);
	} else if (msgStr.toLowerCase().startsWith(`${prefix} list`)) {
		if (!channels.includes(channel.id)) {
			return channel.send(
				":x: This is not a valid live-links channel. Try this command again in the proper channel."
			);
		}
		let leagueJson = await util.findLeagueId(channel.id);
		let playersIds = await util.getPlayersIds(leagueJson.id);
		let finalMessage = await channel.send("Gathering league's players...");
		let players = [];
		let funcarr = [];
		for (let playerId of playersIds) {
			funcarr.push(
				new Promise(async (resolve, reject) => {
					await base("Players").find(
						playerId,
						async (err, record) => {
							if (err) reject(err);

							let name = await record.get("Showdown Name");
							players.push(`\n${name}`);
							resolve();
						}
					);
				})
			);
		}
		await Promise.all(funcarr);
		let playersStr = players.join();
		//If players list is empty
		if (!playersStr) playersStr = "-";

		const listEmbed = new Discord.RichEmbed()
			.setTitle(leagueJson.name)
			.addField("Players", playersStr);

		return await finalMessage.edit(listEmbed);
	} else if (msgStr.toLowerCase().startsWith(`${prefix} clear`)) {
		//Finding the league that is being cleared
		let leagueJson = await util.findLeagueId(channel.id);

		//Clearing the league
		await base("Leagues").update([
			{
				id: leagueJson.id,
				fields: {
					Players: [],
				},
			},
		]);

		console.log(`${leagueJson.name}'s player database has been cleared.`);
		return channel.send(
			`\`${leagueJson.name}\`'s player database has been cleared.`
		);
	} else if (msgStr.toLowerCase().startsWith(`${prefix} mode`)) {
		let mode;
		let discordMode = msgParams.split(" ")[0];
		let streamChannel = "";
		let sheetId = "";
		switch (discordMode) {
			case "-c":
				mode = "Channel";
				streamChannel = msgParams.split(" ")[1];
				break;
			case "-dm":
				mode = "DM";
				break;
			case "-default":
				mode = "";
				break;
			case "-s":
				mode = "Sheets";
				sheetId = msgParams.split(" ")[1].split("/")[5];
				break;
			default:
				return channel.send(
					"Need help? Here we go!\n```To use the command, type this: porygon, use mode [either -c, -dm, -default, or -sheets] [optional extension] [optionally --combine] \n\n-c: match-results channel mode. Make sure to link to the channel you want to be the match-results channel to the end of the message. \n-dm: author DM mode.\n-sheets: google sheets mode. Make sure you link the sheet's url at the end of this message, and also give full editing perms to porygon-bot@real-porygon.iam.gserviceaccount.com. \n-default: default mode.\n\nMake sure you send this command in the channel you want to make the live-links channel; its name also has to have either live-links or live-battles in it.\nAttach --combine at the end of your message if you would like passive and direct kills combined in your stats.```"
				);
		}

		let leagueInfo = await util.findLeagueId(channel.id);
		if (leagueInfo.id) {
			await base("Leagues").update([
				{
					id: leagueInfo.id,
					fields: {
						"Channel ID": channel.id,
						"Combine P/D?": msgParams.includes("--combine"),
						"Stream Channel ID": streamChannel.substring(2, streamChannel.length - 1),
						"Stats System": mode,
						"Sheet ID": sheetId,
					},
				},
			]);

			console.log(`${leagueInfo.name}'s mode has been changed to ${mode ? mode : "Default"} mode!`);
			return channel.send(
				`\`${leagueInfo.name}\`'s mode has been changed to ${mode ? mode : "Default"} mode!`
			);
		} else {
			// Message Collector for the required info for the bot
			const filter = (m) => m.author === message.author;
			const collector = message.channel.createMessageCollector(filter, {
				max: 3,
			});

			await channel.send(
				"What is this league's name? [the whole of your next message will be taken as the league's name]"
			);
			collector.on("collect", async (m) => {
				let leagueName = m.content;
				base("Leagues").create([
					{
						fields: {
							Name: leagueName,
							"Channel ID": channel.id,
							"Combine P/D?": msgParams.includes("--combine"),
							"Stream Channel ID": streamChannel.substring(2, streamChannel.length - 1),
							"Stats System": mode,
							"Sheet ID": sheetId,
						},
					},
				]);
				collector.stop();

				console.log(`${leagueName}'s mode has been changed to ${mode ? mode : "Default"} mode!`);
				return channel.send(
					`\`${leagueName}\`'s mode has been changed to ${mode ? mode : "Default"} mode!`
				);
			});
		}
	}
});

bot.login(token);
