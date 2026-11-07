SECTION: BUILDINGS

Building | Function | Notes
Clay Cluster | Evolvable root building | Strengthened by proximity to other buildings and elevations
Wall | Proximity-based defense | Provides a defensive bonus to adjacent buildings
Queen | Sole unit producer | Stationary. Capture target. Produces everything except Aphids


SECTION: UNITS

Unit | HP | ATK | DEF | Regeneration (HP/s) | Carrying Capacity | Cost | Notes
Ant Worker | 20 | 3 | 5 | 0 | 2 total units of water/clay/glucose | 5 Water | Economic engine. Cannot harvest flowers directly. Collects glucose from Aphids and delivers it to a palace.
Warrior | 100 | 15 | 50 | 0.5 | 2 total units of water/clay/glucose | 5 Water + 6 Glucose | Primary combat unit. Moves corpses (planned)
Flyer | 50 | 10 | 5 | 0 | 1 total unit of water/clay/glucose | 4 Water + 4 Glucose | Fast and fragile. Attacks. Upgradable to Flying Warrior (planned)
Flying Warrior | 150 | 25 | 50 | 0.5 | 2 total units of water/clay/glucose | Warrior + 3 Water + 8 Glucose | Evolution of the Warrior (planned)
Aphids | 5 | 0 | 0 | 0.2 | 1 total unit of water/glucose | Neutral Gaia units | Immune to rot. Provides healing and harvests glucose from flowers. Ant Workers tame them in 10 seconds.
Queen | 1000 | 10 | 90 (capped; base DEF 200) | 0 | 0 | 200 Water + 300 Glucose | Stationary. Produces everything except Aphids
Young Queen | 100 | 50 | 0 | 0.1 | 0 | 50 Water + 50 Glucose | Moves quickly. Attacks. Vulnerable Only produces units when stationed at a palace.


SECTION: Aphids - MODES

Mode | Requirement | Effect
Gathering | Adjacent to a flower | +1 glucose unit every 2 seconds (max 1)
Healing | - | +2 HP/s on the Aphid tile and the 8 surrounding tiles; up to 8 Aphids may heal one unit. Disease curing takes 3 seconds.
Acceleration | Adjacent to the queen + spend 1 charge | Planned: -4% production time for the next ant (2 charges = 8%)


SECTION: Aphids - ATTRIBUTES

Attribute | Value
Movement | 1 tile every 2 seconds (1.5 seconds when carrying glucose)
Health | 5
Armor | 0
Attack | 0 (flees only)
Glucose capacity | 1 unit
Control | Neutral Gaia Aphids are tamed by an adjacent Ant Worker after 100 ticks (10 seconds); enemy Aphids can also be stolen.
Limit | Unlimited (constrained by available flowers)
Upon death | Leaves a level 1 corpse; glucose drop tile is planned
Immunity | Immune to rot
Special ability | Cures one adjacent infected allied unit after 3 seconds; no glucose cost is currently required


SECTION: FLOWERS AND GLUCOSE

Aspect | Detail
Tile type | Resource tile with a colored marker: flowers produce glucose
Gatherer | Aphids only
Produces | Glucose
Harvest time | 2 seconds per glucose unit
Depletion | Resource quantity decreases after each extraction
Vulnerability | Can be destroyed by enemies
Use 1 | Gather glucose for Aphid modes
Use 2 | Accelerate queen production (-4% per charge)
Use 3 | Planned: heal a unit (+15 HP per charge)
Use 4 | Planned: cure a unit's disease (1 charge); current cure uses the Aphid ability without spending glucose
Use 5 | Planned: unlock Flying Warrior


SECTION: ROT (SYSTEM) GLOBAL)

Phase | Detail
1. Death | Any unit that dies leaves a levelled corpse in its cell for 60 seconds.
2. Waiting | A corpse begins damaging nearby units according to its level.
3. Sickness | Non-Aphid units must remain within 1 tile of a corpse for more than 3 seconds to become infected; infected units lose HP progressively.
4. Contagion | An infected non-Aphid has a 2-in-3 chance each second to infect an uninfected non-Aphid within 1 tile.
5. Transformation | If a sick unit's HP drops to 10%, it becomes hostile toward everyone.
6. Cleanup | The corpse disappears after 600 ticks (60 seconds at 10 ticks/s).
7. Immunity | Aphids are immune. An adjacent Aphid can cure one infected ally after 30 ticks (3 seconds).

CORPSE LEVELS

Unit group | Corpse level | Disease damage | Damage interval
Ant Worker, Aphid, Flyer | 1 | 2 HP | 20 ticks (2 seconds)
Warrior, Flying Warrior, Young Queen | 2 | 3 HP | 20 ticks (2 seconds)
Queen | 3 | 8 HP | 30 ticks (3 seconds)


SECTION: BIOLOGICAL WARFARE

Strategy | Description
Contaminated Zone | Accumulate corpses at a strategic choke point to block enemy advancement.
Biological Warfare | Transport corpses to the enemy base using warrior units.
Defensive Cleanup | Remove corpses from your own base before they begin to decay.
Bait | Leave a corpse near an aggressive insect so it becomes sick and turns hostile.
Flower Control | Contaminate enemy-controlled flowers to infect their aphids.


SECTION: PLAYSTYLE

Win Conditions | Lose Conditions
Economy based on workers and aphids, Units are fragile in direct combat. |
Early exploration to tame aphids, Loss of a queen (catastrophic). |
Expansion via new queens, Weak defense of structures. |
Optimization of glucose transport routes, Reliance on aphids for healing. |
Biological warfare using corpses, Competition with the enemy for flowers. |


SECTION: GAME LOOP

Step | Action
1 | Produce workers at the queen.
2 | Transport resources. with worker ants
3 | Explore the map to find flowers and wild aphids
4 | Tame neutral or enemy Aphids using Ant Workers (10 seconds while adjacent)
5 | Send aphids to collect glucose
6 | Decide how to use glucose (healing / speeding up / unlocking / curing disease)
7 | Produce a new queen once resources are available
8 | Establish a new base with the new queen
9 | Fortify flowers and queens with walls
10 | Apply pressure using warrior ants and flying units


SECTION: RELATIONSHIP WITH OTHER FACTIONS

Vs. | Ant Advantage | Ant Disadvantage
Beetles | Rapid expansion and sustained healing | Their structures are much more durable
Wasps | Can heal and withstand sieges | Wasps can fly and harass without being reached


SECTION: COMBAT FORMULA

Concept | Formula
Effective Defense | Effective_DEF = min(DEF, 90)
Final Damage | Damage = max(1, ATK x (1 - Effective_DEF/100))


Decisions:

## VICTORY
- You lose when all your queens die, even if other units remain.
- As long as one queen survives, you remain in the game and can make a comeback: she produces units and can raise a new, young queen.
- The opponent wins the moment they kill your last queen.
- Pending: if a worm...or a young queen counts as a "living queen" once the last queen mother dies.
- Current implementation does not yet enforce a victory condition.


## MAP

### Layers (a list of values ​​per cell; position = y * width + x)
- Terrain: normal, water, clay
- Elevation: 0, 1, 2...
- Ramp: yes / no (the only way to move between different elevations)
- Resource: none, clay, flower, plant (includes remaining quantity)
- Units and buildings are NOT part of the map; they are stored in separate lists.

### Movement Rules
- Land units: cannot enter water.
- Movement between adjacent cells is only possible if they share the same elevation, or if one is a ramp and the elevation difference is 1.
- Amphibious units: land units that evolve to gain the ability to cross water.
- Flying units: ignore water and elevation. When over low terrain (elevation 0), they are immune to melee attacks. When over high terrain (elevation 1 or greater), this advantage is lost, and they can be targeted by melee attacks just like land units. Moving back to low terrain provides protection.
- Subterranean units (Coleoptera, future feature): travel slowly underground and remain unseen. They have no vision until they emerge to the surface, at which point they become vulnerable.
- Workers can collect water from an adjacent cell without entering it.

### Modifiable Terrain
- Occupied cell (containing a unit or building): cannot be modified.
- Future concept: Large structures (e.g., a clay palace) may also grant the "high terrain" effect to flying units positioned above them. This will be evaluated during combat calculations.

### Technical Decisions
- File: `src/simulacion/mapa.ts` (independent of the Phaser framework).
- Initial test map: 160x160, manually defined. Procedural generation (using a seed) to be implemented later.
- Cell size (on-screen): 32 px (adjustable).

### Pending Items
- Puddles: either traversable (slowing movement) or impassable, like rivers. For now, impassable.
- Define exactly when a flying unit is vulnerable to melee attacks (see note in NOTES.md).


SECTION: IMPLEMENTED BEHAVIOR NOT PREVIOUSLY SPECIFIED

SIMULATION

Item | Implemented behavior
Tick rate | 10 ticks per second. Simulation state changes only inside tick().
Movement | Orthogonal and diagonal routes use the existing terrain/ramp rules. Diagonal steps take 4 ticks; other steps take 3 ticks.
Attacks | Units attack adjacent units or buildings once per second. Explicit attack orders may target allies or the unit itself.
Damage | Effective DEF is capped at 90. Damage is max(1, ATK * (1 - effective DEF / 100)).
Disease | Infection persists after the originating corpse expires. Disease damage continues until an Aphid completes its cure.
Disease exposure | Units require more than 30 consecutive ticks within 1 tile of a corpse before infection. Leaving the aura resets that corpse's exposure counter.
Contagion RNG | Spread uses the simulation's seeded deterministic generator; each infected unit checks adjacent units once per second.
Healing limit | A wounded unit with more than 8 nearby Aphids is not healed and produces a red HUD error. Full-health units receive no healing events.
Glucose logistics | Aphids harvest one glucose unit from flowers in 2 seconds. Ant Workers take 0.5 seconds to collect glucose from an adjacent loaded Aphid, then deliver it to a palace.
Glucose work loop | After delivery, the Ant Worker returns to the same Aphid. The Aphid returns to its flower after its glucose is collected. A new order stops the loop.
Gaia Aphids | Each connected flower group spawns up to five neutral Aphids. Ant Workers can tame neutral or enemy Aphids after 100 adjacent ticks (10 seconds), transferring them to the worker's player.

PLAYER CONTROL

Control | Behavior
Left click | Select a local unit/building, inspect an enemy unit, or inspect a corpse.
Selection marquee | Selects local units only; enemy units are never added to the controllable selection.
Right click | Move selected units, collect normal resources, attack enemy targets, or collect glucose from a loaded friendly Aphid.
A key / Attack button | Arms attack targeting. The next clicked unit can be an enemy, ally, or the selected unit itself.
Cure Disease button | Arms target selection for selected Aphids. The target must be an infected allied unit within the Aphid healing range.
Tame button | Selected Ant Workers can target a neutral or enemy Aphid; stay adjacent for 10 seconds to transfer its ownership.
Middle mouse drag | Moves the terrain camera.
Minimap click/drag | Centers and moves the camera to the selected minimap position.
Arrow keys | Move the camera.

CLIENT AND HUD

Item | Implemented behavior
Player colors | Local player units/buildings are blue. Enemy units/buildings are red. A reusable player palette is prepared for future players and sprites.
Health bars | Units and buildings show current HP bars. The top HUD HP button toggles them.
Cargo bars | Water is blue, clay is yellow, and glucose is pink. Cargo capacity is enforced across all resource types.
Disease indicator | Selected infected units show VIRAL DISEASE in red on the bottom HUD.
Corpse inspection | Clicking a corpse shows its level, cell, and remaining lifetime in ticks and seconds.
Damage feedback | Damage changes the target fill color briefly to red and shows floating damage text. There is no opacity blink.
Healing feedback | The target receives a green pulse and healing text. The healing Aphid receives a green expanding aura.
Attack feedback | The attacker pulses and emits a thin red triangular attack line toward the target.

TEST SCENE

The current test scene contains two local palaces, three local Ant Workers, one local Aphid, one enemy Ant Worker, and neutral Gaia Aphids around flower groups. Neutral Aphids can be tamed; the enemy can be inspected or attacked.


SECTION: CURRENT LIMITATIONS

- Glucose spending for instant +15 HP healing, production acceleration, unit evolution, corpse transport, and dropped glucose corpse cargo are not implemented yet.
- Corpses are simulation entities and do not block movement.
- Enemy AI is not implemented; enemy units remain idle until future player/AI control is added.