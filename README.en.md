# Moss & Gold

[日本語](README.md)

![A party of adventurers around a campfire. A spider sits by the wall on the right, and the moss on the floor glows purple.](docs/img/readme-camp.png)

Play it here: <https://moss-and-gold.snsgr.workers.dev> (works in desktop and phone browsers). The game's screen is in Japanese only for now.

## What this is

I am making a game where you watch creatures live inside a dungeon. That is all you do. The player does not control anything.

Moss and mushrooms grow, giant rats and kobolds eat them, and adventurers and goblins come in. Each rule on its own is simple, but when they combine, things happen that I did not expect. I like watching that, so I am making this.

Each dungeon is made from a seed (a word the dungeon is generated from). The same seed always gives the same dungeon, and the same things happen in it.

## What to watch for

One day in the game takes 24 minutes at normal speed (1×). On the first day you will mostly see small creatures and adventurers. Kobolds, goblins and orcs usually settle only after day 8, so I think it is best to fast-forward until then (at 30×, one day takes 48 seconds).

Creatures are drawn in dark colors even where no light reaches them. Tap or click a creature to see its name and what it is doing, and the camera will follow it.

### Ground and light

![A pool of lava with a crust formed around it. The creature shaped like a flame at the bottom is a salamander.](docs/img/readme-lava.png)

- During the day, sunlight comes in through cracks in the ceiling.
- Moss glows pale blue and mushrooms glow pale purple. The richer the soil, the brighter they are.
- Water springs up, flows, pools, and drains into sinkholes. A crust forms around lava, and salamanders crawl beside it.
- At first only a small cave near the entrance is open. The other caverns show faintly through the rock, and when a creature digs into one, the whole cavern opens at once.

### Creatures that eat moss, and those that hunt them

- Wisps are specks of light born from moss. They gather around glowing moss and avoid sunlight and fire.
- Giant rats come in through cracks in the ceiling, sleep huddled in their burrows, and breed. When they have eaten the moss around them, they move to a new burrow in a single line.
- Bats come in at dusk and sleep hanging from the ceiling during the day.
- Spiders spin webs along the walls. Myconids stand up from a patch of mushrooms, walk, and sit down to become a new patch.
- A creature that notices prey gets a "!" over its head. After killing prey, it stays and eats for a while.

### Peoples that settle

![Creatures sleeping by water lit from the ceiling (marked with z). On the wall to the right is the side tunnel and traps of a kobold warren.](docs/img/readme-sleepers.png)

- Kobolds dig a side tunnel into the rock wall and make it their warren. You can see bone decorations at the entrance, straw beds, stores of mushrooms, a field, and iron traps. When adventurers come near, the kobolds hide deep inside, and only dark shapes and glowing eyes are visible.
- Goblins build a camp with tents and a bonfire. At night they sneak up on adventurers resting by their campfire and steal from their packs, or snatch packs in the passages.
- Orcs take over nearby goblin camps. A red banner goes up over a camp they control. A hungry orc goes there, stuffs the camp's stores into a sack, and carries it home. Faced with a party it cannot beat, an orc growls and clashes its weapon, then backs off.
- In some dungeons, the goblin and orc scenes never happen at all.

### People from outside

![A dwarf hall. Treasure chests and piles of gold sit on the stone floor, and a golem stands in the middle.](docs/img/readme-dwarves.png)

- Adventurers come in through the main entrance, lighting their way with torches. The first party arrives about 15 minutes after you start.
- When they are tired, they sit around a campfire with one of them on watch. The one on watch sometimes dozes off.
- The town has a roster of 12 people, and the same faces come back. You can tell them apart by the shape of their head ornaments. Their rank goes up with the number of times they return, and the shape and color of their gear change with it. A hero makes one last expedition with an apprentice and then retires. When an adventurer above apprentice rank dies, a grave marker goes up, and parties that come later stop in front of it.
- Dwarves come as a group of miners, smiths and warriors, and dig a hall with pillars and straight mine tunnels. But most groups cannot find a place to live and leave.

### Death and the undead

- Bodies go from fresh to rotting to bones, and slimes dissolve them.
- Ghosts appear, half see-through, in dark places where many have died, and blow out the adventurers' torches.
- Trolls that are caught in sunlight turn to stone.

### The deep, and mana

- A golem stands at the entrance of the treasure vault, and a worm sleeps in the deep. After a few days the worm wakes up and tunnels through the rock.
- Where mana has built up, purple specks swirl together, and trolls and basilisks are born.
- After a few days, a dragon egg starts to glow and crack, and a young dragon comes out. The young dragon chases bats. As it grows, it carries gold in its mouth back to its lair, and in time it sleeps on top of a pile of treasure.

## What is missing

There is still a lot missing. There are no biomes yet, and I want the way the labyrinth is generated to mean more. I want many more monsters, and I want the dungeon and the monsters to look better.

I also think it is hard to tell from the screen what is going on. For example, when a group abandons its home and leaves, the screen does not show why it left.

## What I would like to ask

I have a few questions for people who have tried it.

- Watching without reading any explanation, could you tell what was going on? Which scenes did you not understand?
- How long did you keep watching? What made you stop?
- Are there creatures or scenes you would like to see?

## Controls

| Action | Desktop | Phone |
| --- | --- | --- |
| Move the view | Drag, WASD or arrow keys | Drag with one finger |
| Zoom (1× to 4×) | Mouse wheel, + / − keys, the − / + buttons at the bottom right | Pinch with two fingers |
| Speed | The buttons at the top left: stop (停止), 1×, 3×, 10×, 30× | Same |
| Look at a creature | Click it to show its info; the camera follows it | Tap it |
| Map | Click the minimap at the top right to move there | Tap it |
| Log | Bottom left. "Expand" (広げる) shows up to 60 entries. Choose an entry to move there | Same |
| Hide the UI | Double-click | Double-tap |
| Another dungeon | The "Seed" (シード) button at the top right: type a word to make a dungeon from it, or choose "New dungeon" (新しいダンジョン) | Same |

The game saves automatically every 10 seconds, and when you open the page again it continues from where you left off.

## Running it locally

```bash
npm install
npm run build   # creates dist/index.html
npm test        # checks that the same seed gives the same run, and that the totals of nutrients and gold are conserved
```

Open dist/index.html in a browser. Rendering is plain WebGL2 with no libraries (only the font is loaded from Google Fonts). The development guide is [CLAUDE.md](CLAUDE.md) (in Japanese).
