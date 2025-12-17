const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder, ChannelType } = require('discord.js');
const fs = require('fs');
const express = require('express');

// --- CONFIGURATIE ---
const TOKEN = 'MTQ1MDg3Njc3NDc4NjI2OTI2NQ.GsVYC0.PkrOPlzEeTO0Qy-0YQ9HAjQAkLd8cKbsbYXQ-o';
const CLIENT_ID = '1450876774786269265';
const GUILD_ID = '1450859240058261624';
const REVIEW_CHANNEL_ID = '1450868280305782897';
const STAFF_ROLE_ID = '1450859305598189719';
const OFFERTE_LOG_ID = '1450913954900606998'; // Waar de staff de aanvragen ziet 



const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
const DB_FILE = './licenties.json';

// --- DATABASE FUNCTIES ---
function loadLicenties() {
    if (!fs.existsSync(DB_FILE)) return [];
    try { return JSON.parse(fs.readFileSync(DB_FILE)); } catch (e) { return []; }
}
function saveLicenties(data) { fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); }

// --- RENDER KEEPALIVE ---
const app = express();
app.get('/', (req, res) => res.send('Bot is Online!'));
app.listen(3000);

// --- 1. COMMANDO DEFINITIES ---
const commands = [
    new SlashCommandBuilder()
        .setName('review')
        .setDescription('Laat een beoordeling achter')
        .addStringOption(o => o.setName('product').setDescription('Welk product?').setRequired(true))
        .addIntegerOption(o => o.setName('sterren').setDescription('1-5 sterren').setMinValue(1).setMaxValue(5).setRequired(true))
        .addStringOption(o => o.setName('bericht').setDescription('Wat vond je ervan?').setRequired(true)),

    new SlashCommandBuilder()
        .setName('licentie-add')
        .setDescription('Voeg een licentie toe (Staff)')
        .addUserOption(o => o.setName('target').setDescription('De klant').setRequired(true))
        .addStringOption(o => o.setName('product').setDescription('Productnaam').setRequired(true))
        .addStringOption(o => o.setName('code').setDescription('De licentiecode').setRequired(true)),

    new SlashCommandBuilder()
        .setName('licentie-remove')
        .setDescription('Verwijder een licentie (Staff)')
        .addStringOption(o => o.setName('code').setDescription('De code').setRequired(true)),

    new SlashCommandBuilder()
        .setName('mijn-licenties')
        .setDescription('Bekijk je eigen licenties'),

    new SlashCommandBuilder()
        .setName('announcement')
        .setDescription('Maak een officiële aankondiging (Staff)')
        .addChannelOption(o => o.setName('kanaal').setDescription('Waar moet de aankondiging heen?').addChannelTypes(ChannelType.GuildText).setRequired(true))
        .addStringOption(o => o.setName('titel').setDescription('De titel van de aankondiging').setRequired(true))
        .addStringOption(o => o.setName('bericht').setDescription('De inhoud van het bericht').setRequired(true)),

    new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Verwijder berichten (Staff)')
        .addIntegerOption(o => o.setName('aantal').setDescription('Hoeveel?').setRequired(true).setMinValue(1).setMaxValue(100)),

    new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Verban een gebruiker en stuur een DM (Staff)')
        .addUserOption(o => o.setName('target').setDescription('De te verbannen gebruiker').setRequired(true))
        .addStringOption(o => o.setName('reden').setDescription('De reden voor de ban').setRequired(true)),
    new SlashCommandBuilder()
        .setName('tos')
        .setDescription('Ontvang onze Algemene Voorwaarden in je DM'),
        new SlashCommandBuilder()
        .setName('offerte')
        .setDescription('Vraag een prijsopgave aan voor een custom script')
        .addStringOption(o => o.setName('omschrijving').setDescription('Wat moet het Product precies doen?').setRequired(true))
        .addStringOption(o => o.setName('budget').setDescription('Wat is je maximale budget?').setRequired(true)),
].map(command => command.toJSON());

// --- 2. REGISTRATIE ---
const rest = new REST({ version: '10' }).setToken(TOKEN);
(async () => {
    try {
        await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
        console.log('Alle commando\'s succesvol geladen!');
    } catch (e) { console.error(e); }
})();

// --- 3. COMMANDO AFHANDELING ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;
    const { commandName, options, member, user, guild } = interaction;
    const isStaff = member.roles.cache.has(STAFF_ROLE_ID);

    // --- ANNOUNCEMENT ---
    if (commandName === 'announcement') {
        if (!isStaff) return interaction.reply({ content: 'Geen toegang!', ephemeral: true });

        const kanaal = options.getChannel('kanaal');
        const titel = options.getString('titel');
        const bericht = options.getString('bericht').replace(/\\n/g, '\n'); // Maakt \n mogelijk voor nieuwe regels

        const embed = new EmbedBuilder()
            .setColor(0xFFA500) // Oranje kleur
            .setTitle(`📢 ${titel}`)
            .setDescription(bericht)
            .setFooter({ text: `Aangekondigd door ${user.username}`, iconURL: user.displayAvatarURL() })
            .setTimestamp();

        await kanaal.send({ embeds: [embed] });
        await interaction.reply({ content: `✅ Aankondiging verstuurd naar ${kanaal}!`, ephemeral: true });
    }

    // --- MIJN LICENTIES ---
    if (commandName === 'mijn-licenties') {
        const db = loadLicenties();
        const mine = db.filter(l => l.userId === user.id);
        const embed = new EmbedBuilder().setThumbnail(user.displayAvatarURL()).setTimestamp();

        if (mine.length === 0) {
            embed.setColor(0xFF0000).setTitle('Geen Licenties Gevonden ❌').setDescription(`${user.username} heeft geen licenties.`);
        } else {
            embed.setColor(0x00FF00).setTitle(`Licenties van ${user.username} ✅`);
            mine.forEach(l => embed.addFields({ name: `📦 ${l.product}`, value: `Code: \`${l.code}\` (${l.date})` }));
        }
        await interaction.reply({ embeds: [embed] });
    }

    // --- LICENTIE ADD ---
    if (commandName === 'licentie-add') {
        if (!isStaff) return interaction.reply({ content: 'Geen toegang.', ephemeral: true });
        let db = loadLicenties();
        db.push({ userId: options.getUser('target').id, product: options.getString('product'), code: options.getString('code'), date: new Date().toLocaleDateString() });
        saveLicenties(db);
        await interaction.reply({ content: '✅ Toegevoegd!', ephemeral: true });
    }

    // --- CLEAR ---
    if (commandName === 'clear') {
        if (!isStaff) return interaction.reply({ content: 'Geen toegang!', ephemeral: true });
        const aantal = options.getInteger('aantal');
        await interaction.channel.bulkDelete(aantal, true);
        await interaction.reply({ content: `✅ ${aantal} berichten verwijderd.`, ephemeral: true });
    }

    // --- REVIEW ---
    if (commandName === 'review') {
        const channel = client.channels.cache.get(REVIEW_CHANNEL_ID);
        if (!channel) return interaction.reply({ content: 'Kanaal niet gevonden.', ephemeral: true });
        const embed = new EmbedBuilder().setColor(0x00FF00).setTitle('Review!').addFields(
            { name: 'Klant', value: `<@${user.id}>`, inline: true },
            { name: 'Product', value: options.getString('product'), inline: true },
            { name: 'Score', value: '⭐'.repeat(options.getInteger('sterren')), inline: true },
            { name: 'Bericht', value: options.getString('bericht') }
        );
        await channel.send({ embeds: [embed] });
        await interaction.reply({ content: 'Gepost!', ephemeral: true });
    }

    // --- BAN COMMANDO ---
    // --- VERBETERDE BAN COMMANDO ---
    if (commandName === 'ban') {
        if (!isStaff) return interaction.reply({ content: 'Geen toegang!', ephemeral: true });

        // Vertel Discord dat we tijd nodig hebben (geen Unknown Interaction error meer!)
        await interaction.deferReply({ ephemeral: true });

        const targetUser = options.getUser('target');
        const reden = options.getString('reden');
        const memberTarget = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!memberTarget) return interaction.editReply({ content: 'Gebruiker niet gevonden in deze server.' });
        if (!memberTarget.bannable) return interaction.editReply({ content: 'Ik kan deze gebruiker niet verbannen (hogere rol?).' });

        const banEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('⛔ | Verbannen uit ✨ MiKaYlAa\'s ShOp.nl ✨')
            .setDescription(`Met de volgende reden:\n\n**Reden:** ${reden}`)
            .setTimestamp();

        // Probeer DM te sturen
        try {
            await targetUser.send({ embeds: [banEmbed] });
        } catch (e) {
            console.log("Kon geen DM sturen naar de gebruiker.");
        }

        // Voer de ban uit
        await memberTarget.ban({ reason: reden });

        // Gebruik editReply omdat we eerder deferReply hebben gebruikt
        await interaction.editReply({ content: `✅ **${targetUser.tag}** is verbannen en heeft een DM ontvangen.` });
    }

    // --- TOS COMMANDO (In DM) ---
    if (commandName === 'tos') {
        const tosEmbed = new EmbedBuilder()
            .setColor(0xFF4500) // Oranje-rood
            .setTitle('📜 Algemene Voorwaarden - ✨ MiKaYlAa\'s DeVeLoPmEnT ✨')
            .setDescription('Door gebruik te maken van onze diensten of het aanschaffen van onze producten, ga je akkoord met de volgende voorwaarden:')
            .addFields(
                { name: '🚫 Geen Verspreiding (Anti-Leak)', value: 'Het is streng verboden om onze scripts, code of bestanden te delen, door te verkopen of te publiceren zonder schriftelijke toestemming.' },
                { name: '💳 Refund Beleid', value: 'Vanwege het digitale karakter van onze producten bieden wij geen terugbetalingen aan nadat de bestanden zijn geleverd.' },
                { name: '🛠️ Support', value: 'Support wordt uitsluitend verleend aan de officiële koper via ons ticketsysteem.' },
                { name: '⚖️ Wijzigingen', value: 'Wij behouden het recht om deze voorwaarden op elk moment aan te passen.' }
            )
            .setFooter({ text: 'Bedankt voor je akkoord en veel plezier met je aankoop!' })
            .setTimestamp();

        try {
            // Verstuur naar DM
            await user.send({ embeds: [tosEmbed] });
            // Bevestig in het kanaal (alleen zichtbaar voor de gebruiker zelf)
            await interaction.reply({ content: '✅ De ToS is naar je DM gestuurd!', ephemeral: true });
        } catch (error) {
            // Als de DM dicht staat
            await interaction.reply({ content: '❌ Ik kon je geen DM sturen! Zet je DM-instellingen open voor deze server.', ephemeral: true });
        }
    }

    // --- OFFERTE SYSTEEM ---
    if (commandName === 'offerte') {
        const omschrijving = options.getString('omschrijving');
        const budget = options.getString('budget');
        const logChannel = client.channels.cache.get(OFFERTE_LOG_ID);

        if (!logChannel) return interaction.reply({ content: 'Fout: Offerte kanaal niet gevonden!', ephemeral: true });

        // Embed voor de Staff
        const staffEmbed = new EmbedBuilder()
            .setColor(0xFFFF00) // Geel voor aandacht
            .setTitle('📝 Nieuwe Offerte Aanvraag')
            .addFields(
                { name: 'Klant', value: `<@${user.id}> (${user.tag})` },
                { name: 'Budget', value: `\`${budget}\`` },
                { name: 'Project Omschrijving', value: omschrijving }
            )
            .setTimestamp();

        await logChannel.send({ embeds: [staffEmbed] });

        // Bevestiging aan de klant
        await interaction.reply({ 
            content: '✅ Je aanvraag is verstuurd naar ons team! We nemen zo snel mogelijk contact met je op.', 
            ephemeral: true 
        });
    }
});

client.login(TOKEN);