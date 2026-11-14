const { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  Collection, 
  EmbedBuilder, 
  PermissionFlagsBits,
  ActivityType
} = require('discord.js');

// ======================== CONFIG / VARIABLES ========================
const config = {
  token: process.env.TOKEN,              // Token from Render Environment Variable
  prefix: '!',                           // Command prefix
  botName: 'Mass Ban System',            // Bot activity name
  ownerOnlyMassBan: false,               // false = any Administrator can use massbanall
  skipAdministrators: true,              // Skip members with Administrator permission
  banDelay: 350,                         // Delay between bans (ms)
  leaveAfterMassBan: true,               // Bot leaves the server after mass ban
  leaveDelay: 3000                       // Delay before leaving (ms)
};

// ======================== CLIENT SETUP ========================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.GuildPresences
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember, Partials.User]
});

client.commands = new Collection();

// ======================== COMMANDS ========================

// Ping Command
client.commands.set('ping', {
  name: 'ping',
  description: 'Check bot latency',
  async execute(message) {
    const sent = await message.reply('🏓 Pinging...');
    const latency = sent.createdTimestamp - message.createdTimestamp;
    const apiLatency = Math.round(client.ws.ping);

    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('🏓 Pong!')
      .addFields(
        { name: 'Bot Latency', value: `\`${latency}ms\``, inline: true },
        { name: 'API Latency', value: `\`${apiLatency}ms\``, inline: true }
      )
      .setTimestamp();

    sent.edit({ content: null, embeds: [embed] });
  }
});

// Help Command
client.commands.set('help', {
  name: 'help',
  description: 'Show all commands',
  async execute(message) {
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('📜 Bot Commands')
      .setDescription('Here are all available commands:')
      .addFields(
        { name: `\`${config.prefix}ping\``, value: 'Check bot latency' },
        { name: `\`${config.prefix}help\``, value: 'Show this help menu' },
        { name: `\`${config.prefix}ban @user [reason]\``, value: 'Ban a member' },
        { name: `\`${config.prefix}kick @user [reason]\``, value: 'Kick a member' },
        { name: `\`${config.prefix}massbanall CONFIRM\``, value: '⚠️ Ban all members (Dangerous)' }
      )
      .setFooter({ text: `Prefix: ${config.prefix}` })
      .setTimestamp();

    message.reply({ embeds: [embed] });
  }
});

// Ban Command
client.commands.set('ban', {
  name: 'ban',
  description: 'Ban a member',
  async execute(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
      return message.reply('❌ You need **Ban Members** permission.');
    }

    const member = message.mentions.members.first();
    if (!member) return message.reply('❌ Please mention a valid member.');
    if (!member.bannable) return message.reply('❌ I cannot ban this member.');

    const reason = args.slice(1).join(' ') || 'No reason provided';

    try {
      await member.ban({ reason: `${reason} | By ${message.author.tag}` });

      const embed = new EmbedBuilder()
        .setColor(0xED4245)
        .setTitle('Member Banned')
        .addFields(
          { name: 'User', value: `${member.user.tag}`, inline: true },
          { name: 'Moderator', value: `${message.author.tag}`, inline: true },
          { name: 'Reason', value: reason }
        )
        .setTimestamp();

      message.reply({ embeds: [embed] });
    } catch {
      message.reply('❌ Failed to ban the member.');
    }
  }
});

// Kick Command
client.commands.set('kick', {
  name: 'kick',
  description: 'Kick a member',
  async execute(message, args) {
    if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) {
      return message.reply('❌ You need **Kick Members** permission.');
    }

    const member = message.mentions.members.first();
    if (!member) return message.reply('❌ Please mention a valid member.');
    if (!member.kickable) return message.reply('❌ I cannot kick this member.');

    const reason = args.slice(1).join(' ') || 'No reason provided';

    try {
      await member.kick(`${reason} | By ${message.author.tag}`);

      const embed = new EmbedBuilder()
        .setColor(0xFEE75C)
        .setTitle('Member Kicked')
        .addFields(
          { name: 'User', value: `${member.user.tag}`, inline: true },
          { name: 'Moderator', value: `${message.author.tag}`, inline: true },
          { name: 'Reason', value: reason }
        )
        .setTimestamp();

      message.reply({ embeds: [embed] });
    } catch {
      message.reply('❌ Failed to kick the member.');
    }
  }
});

// ======================== MASS BAN ALL ========================
client.commands.set('massbanall', {
  name: 'massbanall',
  description: 'Ban all members in the server (extremely dangerous)',
  async execute(message, args) {

    // Only needs Administrator permission now
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xED4245)
            .setDescription('❌ You need **Administrator** permission to use this command.')
        ]
      });
    }

    if (args[0] !== 'CONFIRM') {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(0xFEE75C)
            .setTitle('⚠️ Confirmation Required')
            .setDescription(`You must type \`CONFIRM\` to execute this command.\n\n**Example:**\n\`${config.prefix}massbanall CONFIRM\``)
        ]
      });
    }

    const reason = args.slice(1).join(' ') || 'Mass ban executed';
    const guild = message.guild;

    const members = await guild.members.fetch();
    let banned = 0;
    let failed = 0;

    const status = await message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(0x5865F2)
          .setDescription('🔄 **Mass ban started...** Please wait.')
      ]
    });

    for (const [id, member] of members) {
      if (id === client.user.id) continue;
      if (id === guild.ownerId) continue;
      if (config.skipAdministrators && member.permissions.has(PermissionFlagsBits.Administrator)) continue;

      try {
        await member.ban({
          reason: `${reason} | By ${message.author.tag}`,
          deleteMessageSeconds: 0
        });
        banned++;
      } catch {
        failed++;
      }

      await new Promise(resolve => setTimeout(resolve, config.banDelay));
    }

    const resultEmbed = new EmbedBuilder()
      .setColor(0xED4245)
      .setTitle('Mass Ban Completed')
      .addFields(
        { name: '✅ Banned', value: `\`${banned}\``, inline: true },
        { name: '❌ Failed', value: `\`${failed}\``, inline: true }
      )
      .setFooter({ text: `Executed by ${message.author.tag}` })
      .setTimestamp();

    await status.edit({ embeds: [resultEmbed] });

    if (config.leaveAfterMassBan) {
      setTimeout(async () => {
        try {
          await message.channel.send({
            embeds: [
              new EmbedBuilder()
                .setColor(0x57F287)
                .setDescription('Bot is now leaving the server...')
            ]
          });
          await guild.leave();
        } catch (err) {
          console.error('Failed to leave guild:', err);
        }
      }, config.leaveDelay);
    }
  }
});

// ======================== MESSAGE HANDLER ========================
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild || !message.content.startsWith(config.prefix)) return;

  const args = message.content.slice(config.prefix.length).trim().split(/ +/);
  const commandName = args.shift().toLowerCase();

  const command = client.commands.get(commandName);
  if (!command) return;

  try {
    await command.execute(message, args);
  } catch (error) {
    console.error(error);
    message.reply('❌ An unexpected error occurred while running this command.');
  }
});

// ======================== READY EVENT ========================
client.once('ready', () => {
  console.log('=================================');
  console.log(`✅ Logged in as: ${client.user.tag}`);
  console.log(`📊 Servers: ${client.guilds.cache.size}`);
  console.log(`👥 Users: ${client.users.cache.size}`);
  console.log(`🔧 Prefix: ${config.prefix}`);
  console.log('=================================');

  client.user.setPresence({
    activities: [{ name: config.botName, type: ActivityType.Watching }],
    status: 'online'
  });
});

// ======================== ERROR HANDLING ========================
process.on('unhandledRejection', error => {
  console.error('Unhandled promise rejection:', error);
});

client.on('error', error => {
  console.error('Client error:', error);
});

// ======================== LOGIN ========================
if (!config.token) {
  console.error('❌ TOKEN is missing! Please set the TOKEN environment variable on Render.');
  process.exit(1);
}

client.login(config.token);