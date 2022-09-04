require("dotenv").config();

const { MongoClient } = require("mongodb");
const {
  Client,
  Intents,
  Modal,
  MessageActionRow,
  MessageButton,
  TextInputComponent,
} = require("discord.js");
const client = new Client({
  intents: [
    Intents.FLAGS.GUILDS,
    Intents.FLAGS.GUILD_MEMBERS,
    Intents.FLAGS.GUILD_MESSAGES,
  ],
});

client.on("interactionCreate", async (interaction) => {

  if (interaction.customId.toLowerCase() === "request-whitelist-fivem") {
    return await showModalRequestWhiteListFiveM(interaction);
  }

  if (interaction.isModalSubmit() && interaction.customId.toLowerCase() === "request-whitelist-submit") {
    return await isModalSubmitRequestWhiteListFiveM(interaction);
  }

  if (
    interaction.customId.toLowerCase().startsWith("accept-whitelist") ||
    interaction.customId.toLowerCase().startsWith("decline-whitelist")
  ) {
    return await updateRegisterCheckAcceptedAndDeclined(interaction);
  }

});

const isModalSubmitRequestWhiteListFiveM = async (interaction) => {
  const collectionDiscordWhitelistHol = mongoClientCollection(process.env.DB_NAME, process.env.DISCORD_WHITELIST_HOLD_COLLECTION_NAME);
  const steamIdentifier = interaction.fields.getTextInputValue("steamIdentifierInput").trim();
  const ocName = interaction.fields.getTextInputValue("ocNameInput").trim();
  const icName = interaction.fields.getTextInputValue("icNameInput").trim();
  const storyCharacter = interaction.fields.getTextInputValue("storyCharacterInput");

  if (steamIdentifier.length < 1 || hasWhiteSpace(steamIdentifier)) {
    return await interaction.reply(modalRegisterWhitelistSteamIdentifierFailed(steamIdentifier));
  }
  if (ocName.length < 1) return;
  if (icName.length < 1) return;
  if (storyCharacter.length < 1) return;

  const data = { steamIdentifier, ocName, icName, storyCharacter };

  const findWhitelistHol = await collectionDiscordWhitelistHol.find({ identifier: data.steamIdentifier }).toArray();

  if (Array.isArray(findWhitelistHol) && findWhitelistHol.length > 0) {
    return await interaction.reply(modalRegisterWhitelistCheckDuplicate(data.steamIdentifier));
  }

  const adminCheckWhitelistCh = client.channels.cache.get(process.env.DISCORD_CHANEL_ADMIN_CHECK_WHITELIST);
  if (!adminCheckWhitelistCh) return console.log("Plase set config / discord admin check whitelist not found");
  const modalCheckAdminWhitelistCh = modalRegisterAdminCheckWhitelistCh(data);
  const sendAdminCheckWhitelistCh = await adminCheckWhitelistCh.send(modalCheckAdminWhitelistCh);
  const dataMessageId = sendAdminCheckWhitelistCh.id;

  const dataCreateDiscordWhitelistHold = createCollectionDiscordWhitelistHold(data, interaction, dataMessageId);
  await collectionDiscordWhitelistHol.insertMany(dataCreateDiscordWhitelistHold);

  const contents = modalRegisterWhitelistCh(data);
  await interaction.reply(contents);
};

const showModalRequestWhiteListFiveM = async (interaction) => {
  const whitelistModel = new Modal().setCustomId("request-whitelist-submit").setTitle("ลงทะเบียนไวริส");

  const steamIdentifierInput = new TextInputComponent().setCustomId("steamIdentifierInput").setLabel("เลข Stem Indentifier").setStyle("SHORT");
  const ocNameInput = new TextInputComponent().setCustomId("ocNameInput").setLabel("ชื่อ OC").setStyle("SHORT");
  const icNameInput = new TextInputComponent().setCustomId("icNameInput").setLabel("ชื่อ IC").setStyle("SHORT");
  const storyCharacterInput = new TextInputComponent().setCustomId("storyCharacterInput").setLabel("สตอรี่ของตัวละคร").setStyle("PARAGRAPH");

  const agreementSteamIdentifier = new MessageActionRow().addComponents(steamIdentifierInput);
  const agreementOcName = new MessageActionRow().addComponents(ocNameInput);
  const agreementIcName = new MessageActionRow().addComponents(icNameInput);
  const agreementStoryCharacterName = new MessageActionRow().addComponents(storyCharacterInput);

  whitelistModel.addComponents(agreementSteamIdentifier, agreementOcName, agreementIcName, agreementStoryCharacterName);
  await interaction.showModal(whitelistModel);
};

const updateRegisterCheckAcceptedAndDeclined = async (interaction) => {
  const dataSplit = interaction.customId.split("-");
  const whitelistReq = {
    type: dataSplit[0],
    identifier: dataSplit[2],
  };

  const collectionDiscordWhitelistHol = mongoClientCollection(process.env.DB_NAME, process.env.DISCORD_WHITELIST_HOLD_COLLECTION_NAME);
  const findWhitelistHolWithUser = await collectionDiscordWhitelistHol.findOne({ identifier: whitelistReq.identifier });

  if (!findWhitelistHolWithUser) return await interaction.reply(modalRegisterNotFoundWhitelist(whitelistReq.identifier));

  if (whitelistReq.type.toLowerCase() === "accept") {
    const collectionDiscordWhitelis = mongoClientCollection(process.env.DB_NAME, process.env.DISCORD_WHITELIST_COLLECTION_NAME);
    const dataCreateDiscordWhitelis = createCollectionDiscordWhitelist(findWhitelistHolWithUser);
    await collectionDiscordWhitelis.insertMany(dataCreateDiscordWhitelis);

    await collectionDiscordWhitelistHol.deleteOne({ identifier: whitelistReq.identifier });

    await interaction.reply(modalRegisterConfirmWhitelistSucceed(whitelistReq.identifier, findWhitelistHolWithUser.discordId));
  } else {
    await collectionDiscordWhitelistHol.deleteOne({ identifier: whitelistReq.identifier });
    await interaction.reply(modalRegisterConfirmWhitelistDeclied(whitelistReq.identifier, findWhitelistHolWithUser.discordId));
  }
  await interaction.channel.messages.cache.get(findWhitelistHolWithUser.messageId).delete();
};

const createCollectionDiscordWhitelist = (data) => {
  return [
    {
      identifier: data.identifier,
      discordId: data.discordId,
      ocName: data.ocName,
      icName: data.icName,
      storyCharacter: data.storyCharacter,
    }
  ];
}

const createCollectionDiscordWhitelistHold = (data, interaction, messageId) => {
  return [
    {
      identifier: data.steamIdentifier,
      discordId: interaction.user.id,
      ocName: data.ocName,
      icName: data.icName,
      storyCharacter: data.storyCharacter,
      messageId: messageId,
    }
  ];
}

const hasWhiteSpace = (text) => text.indexOf(" ") >= 0;

const buttonWhitelist = () => {
  const buttonWhitelist = new MessageActionRow()
    .addComponents(
      new MessageButton()
        .setCustomId("request-whitelist-fivem")
        .setLabel("ลงทะเบียนไวริส")
        .setStyle("SUCCESS")
        .setEmoji("909021875064160326")
    );
  return buttonWhitelist;
};

const buttonApproveAcceptWhitelist = (steamIdentifier) => {
  return new MessageActionRow()
    .addComponents(
      new MessageButton()
        .setCustomId(`accept-whitelist-${steamIdentifier}`)
        .setLabel("ยืนยัน")
        .setStyle("SUCCESS")
        .setEmoji("909021875064160326")
    ).addComponents(buttonDeclineWhitelist(steamIdentifier));
}

const buttonDeclineWhitelist = (steamIdentifier) => {
  return (
    new MessageButton()
      .setCustomId(`decline-whitelist-${steamIdentifier}`)
      .setLabel("ยกเลิก")
      .setStyle("DANGER")
  );
}

const modalRegisterConfirmWhitelistDeclied = (steamIdentifier, discordId) => {
  return {
    content: `ยกเลิกการลงทะเบียนไวริส Steam Identifier : ${steamIdentifier} | <@${discordId}>`,
    ephemeral: true,
  };
};

const modalRegisterConfirmWhitelistSucceed = (steamIdentifier, discordId) => {
  return {
    content: `ยืนยันไวริสสำเร็จ Steam Identifier : ${steamIdentifier} | <@${discordId}>`,
    ephemeral: true,
  };
};

const modalRegisterWhitelistSteamIdentifierFailed = (steamIdentifier) => {
  return {
    content: `Steam Identifier: ${steamIdentifier} นี้ไม่ถูกต้อง`,
    ephemeral: true,
  };
};

const modalRegisterNotFoundWhitelist = (steamIdentifier) => {
  return {
    content: `ไม่พบการลงทะเบียนไวริส ${steamIdentifier}`,
    ephemeral: true,
  };
};

const modalRegisterWhitelistCheckDuplicate = (steamIdentifier) => {
  return {
    content: `Steam Identifier: ${steamIdentifier} นี้ได้ลงทะเบียนไปแล้ว`,
    ephemeral: true,
  };
};

const modalWhitelistCh = (buttonWhitelists) => {
  return {
    content: null,
    embeds: [
      {
        title: "วิธีขอไวริส",
        color: 16577780,
        fields: [
          {
            name: "เลข Stem Indentifier",
            value: "ตัวอย่าง stem:xxxxxxx",
          },
          {
            name: "ชื่อ OC",
            value: "กรอกชื่อที่เป็นชื่อจริงที่ไม่ได้ใช้ในเกมส์",
          },
          {
            name: "ชื่อ IC",
            value: "กรอกชื่อที่เป็นชื่อจริงที่ใช้ในเกมส์",
          },
          {
            name: "สตอรี่ของตัวละคร",
            value: "เล่าเรื่องราวสตอรี่ของตัวละคร",
          },
        ],
        footer: {
          text: "Developer by hiroshi",
        },
      },
    ],
    attachments: [],
    components: [buttonWhitelists],
  };
};

const modalRegisterWhitelistCh = (data) => {
  const descriptions = `ลงทะเบียนไวริสสำเร็จ\n\`\`\`\nStem Indentifier: ${data.steamIdentifier}\nชื่อ OC: ${data.ocName}\nชื่อ IC: ${data.icName}\nสตอรี่ของตัวละคร: ${data.storyCharacter}\n\`\`\``;
  return {
    content: null,
    embeds: [
      {
        description: descriptions,
        color: 8126331,
        footer: {
          text: "กรุณารอแอดมินยืนยัน และ จะมีข้อความแจ้งเตือน",
        },
      },
    ],
    attachments: [],
    ephemeral: true,
  };
};

const modalRegisterAdminCheckWhitelistCh = (data) => {
  const descriptions = `ขอลงทะเบียน\n\`\`\`\nStem Indentifier: ${data.steamIdentifier}\nชื่อ OC: ${data.ocName}\nชื่อ IC: ${data.icName}\nสตอรี่ของตัวละคร: ${data.storyCharacter}\n\`\`\``;
  return {
    content: null,
    embeds: [
      {
        description: descriptions,
        color: 8126331,
        footer: {
          text: "กรุณารอแอดมินยืนยัน และ จะมีข้อความแจ้งเตือน",
        },
      },
    ],
    attachments: [],
    components: [buttonApproveAcceptWhitelist(data.steamIdentifier)],
  };
};

const mongoClientCollection = (dbName, dbCollection) => {
  const db = mongoClientUrl().db(dbName);
  const collection = db.collection(dbCollection);
  return collection;
}

const mongoClientUrl = () => {
  return new MongoClient(process.env.MONGO_DB_URL);
}

const connectDB = async () => {
  const mongoClient = mongoClientUrl();
  try {
    await mongoClient.connect();
    console.log("Connect MongoClient Successfully");
  } catch (error) {
    console.log("Connect MongoClient Failed !", error.message);
  } finally {
    await mongoClient.close();
  }
}

client.on("ready", async () => {
  await connectDB();

  const requestWhitelistCh = client.channels.cache.get(process.env.DISCORD_CHANEL_WHITELIST);
  if (!requestWhitelistCh) return console.log("Please set config discord requestWhitelistCh or not found ! :");

  const buttonWhitelists = buttonWhitelist();
  requestWhitelistCh.bulkDelete(100);
  requestWhitelistCh.send(modalWhitelistCh(buttonWhitelists));
});

client.login(process.env.DISCORD_BOT_TOKEN);
