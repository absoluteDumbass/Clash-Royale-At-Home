# Clash Royale At Home
**Clash Royal At Home (CRAT)** is a fanmade project by [me](https://github.com/absoluteDumbass/), mostly to kill time and train my own coding skills.

Currently, it supports multiplayer and spectation. However, theres only a maximum of 1 match active at any given time due to server resource constraints and scope management measures.

# Documentation
## Cards
- **Knight** is a mini-tank that will soak up damage for cheap
- **Arrows** is a spell that deals a moderate amount of area damage
- **Cannon** is a building that anchors defense and deals ranged damage

## The Game object
This is the first or only argument passed down to every callbacks in the script of all cards. It contains all global functions and variables. It will be referred as the `game` object.

### Get and set
`game.get()` allows for 2 arguments, `objectId` and property name, or just property name. It will return the values like any other key-value database, no fuss.

`game.set()` however, are intentionally constrained. You shouldn't directly modify the properties of other objects. If possible, please use other options for that. But otherwise, it takes the arguments of property name and value. Nothing special.

`game.setGlobal()` and `game.getGlobal()` are both counterparts to the original, but they are fully global and interact with `game.global`. It should be used as an information bus.

### Ownership
It has an ownership system that cuts down the amount of references needed to do the most basic of things. For example, you can call `game.get("x")` and it will get the `x` value of the object without needing to know what you're referring to.

If you want to switch the owner to another object, you have 2 options:
1. set `game.objectUsing` directly to the desired objectId
2. use `game.switchId(id)` and `game.revertId()` to temporarily assume the identity of that object temporarily then revert back to your original self.

Unless you are using this for spells and/or projectiles, you shouldn't use this system at all and find alternatives. This is explicitly a low level operation to bypass safety.