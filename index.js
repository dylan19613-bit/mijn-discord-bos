const { Client, GatewayIntentBits, REST, Routes, SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const express = require('express');
const app = express();

app.get('/', (req, res) => {
  res.send('Bot is online!');
});

app.listen(3000, () => {
  console.log('Webserver draait op poort 3000');
});

// ... hieronder de rest van je Discord bot code van de vorige berichten ...

// --- CONFIGURATIE ---
const TOKEN = 'MTQ1MDg3Njc3NDc4NjI2OTI2NQ.GsVYC0.PkrOPlzEeTO0Qy-0YQ9HAjQAkLd8cKbsbYXQ-o';
const CLIENT_ID = '1450876774786269265';
const GUILD_ID = '1450859240058261624'; // Optioneel: voor directe updates op 1 server

const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// --- 1. COMMANDO DEFINITIE ---
const commands = [
    new SlashCommandBuilder()
        .setName('review')
        .setDescription('Laat een beoordeling achter')
        .addIntegerOption(opt => 
            opt.setName('sterren')
            .setDescription('Kies 1 tot 5 sterren')
            .setMinValue(1)
            .setMaxValue(5)
            .setRequired(true))
        .addStringOption(opt => 
            opt.setName('bericht')
            .setDescription('Vertel ons wat je ervan vond')
            .setRequired(true)),
].map(command => command.toJSON());

// --- 2. REGISTRATIE BIJ DISCORD ---
const rest = new REST({ version: '10' }).setToken(TOKEN);

(async () => {
    try {
        console.log('Commando\'s worden geregistreerd...');
        // We registreren hem hier op 1 specifieke server (Guild), dat werkt direct.
        await rest.put(
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID),
            { body: commands },
        );
        console.log('Gelukt! Commando is nu zichtbaar in je server.');
    } catch (error) {
        console.error(error);
    }
})();

// --- 3. DE COMMANDO UITVOERING ---
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'review') {
        const sterren = interaction.options.getInteger('sterren');
        const bericht = interaction.options.getString('bericht');
        const user = interaction.user;

        // Maak een mooi overzichtje (Embed)
        const reviewEmbed = new EmbedBuilder()
            .setColor(0x00FF00) // Groen
            .setTitle('Nieuwe Review! ⭐')
            .setThumbnail(user.displayAvatarURL())
            .addFields(
                { name: 'Gebruiker', value: `${user.username}`, inline: true },
                { name: 'Score', value: '⭐'.repeat(sterren), inline: true },
                { name: 'Feedback', value: bericht }
            )
            .setTimestamp();

        // Stuur het bericht naar het kanaal
        await interaction.reply({ embeds: [reviewEmbed] });
    }
});

client.login(TOKEN);

