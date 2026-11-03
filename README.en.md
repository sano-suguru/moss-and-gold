# Moss & Gold

[日本語](README.md)

A game about watching creatures live on their own in a dungeon.

Rats, goblins and adventurers go about their lives in a cave full of glowing moss. For now, there's no way for the player to step in. It runs in your browser.

**[Play in your browser](https://moss-and-gold.snsgr.workers.dev)** (desktop or phone; the in-game text is Japanese for now)

![A party of adventurers around a campfire, with a spider by the wall and purple glowing moss on the floor](docs/img/readme-camp.png)

## What it is

Moss and mushrooms grow in an underground dungeon. Creatures move in to eat them, and adventurers come down from the surface. The creatures eat, steal from and chase off one another.

Each creature follows fairly simple rules, but put together they do things I didn't plan for. Watching that happen is the reason I'm making this.

## What you can see right now

<img src="docs/img/readme-sleepers.png" width="32%" alt="Creatures asleep by water lit from above, next to a kobold warren in the wall"> <img src="docs/img/readme-lava.png" width="32%" alt="A pool of lava with a flame-shaped salamander beside it"> <img src="docs/img/readme-dwarves.png" width="32%" alt="A dwarf hall with a golem standing by the treasure">

- Glowing moss and mushrooms, underground water and lava. During the day, light comes in through cracks in the ceiling. Wisps, little specks of light born from the moss, drift toward the brightest patches.
- Small creatures that live on the moss, and the things that hunt them.
- Peoples that settle down. Kobolds and goblins build warrens and camps, fight over food with their neighbors, and sometimes end up working for someone stronger.
- Adventurers and dwarves from outside. Adventurers go back to town and come down again, so you'll keep running into the same faces.
- Bigger things sleep further down.

The settlers take a while to show up, so it helps to fast-forward.

## What's missing

A lot. There are no biomes yet, and I'd like the labyrinth layouts to mean something. I want many more monsters, and both the dungeon and the monsters could look a lot better.

What bothers me most is that it's hard to tell from the screen what's going on.

## If you give it a try

I'd love to know:

- whether you could tell what was happening (and which scenes you couldn't follow)
- how long you kept watching
- what creatures or events you'd like to see

## Controls

- Drag to move around (one finger on a phone), scroll to zoom (pinch on a phone).
- The buttons at the top left pause and fast-forward.
- Click or tap a creature to see its name and what it's doing.
- The "シード" (seed) button at the top right makes a new dungeon.
- The game saves on its own, so you can close the page and pick up where you left off.

## Running it locally

```bash
npm install
npm run build   # creates dist/index.html
```

Open dist/index.html in a browser. The development guide is in [CLAUDE.md](CLAUDE.md) (Japanese).
