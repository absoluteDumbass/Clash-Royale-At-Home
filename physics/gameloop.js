const game = {
  objectUsing: 0,
  original: 0,
  prevRandom: 0,
  closest: [-1, Infinity],
  global: {},
  set: function(a, b) {
    // a = property, b = value
    this.match.objects[this.objectUsing][a] = b;
    return b;
  },
  get: function(a, b) {
    // a = object, b = property
    if (a == "self") a = this.objectUsing;
    if (typeof a == "string") return this.match.objects[this.objectUsing][a]
    return this.match.objects[a][b];
  },
  setGlobal: function(a, b) {
    this.global[a] = b;
    return b;
  },
  getGlobal: function(a) {
    return this.global[a];
  },
  random: function(min = 0, max = 1) {
    // not truly random, its based on the tick.
    let seed = this.match.ticks + this.prevRandom * 67 + this.objectUsing * 421;
    seed |= 0; // Ensure seed is a 32-bit integer
    seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    const result = ((t ^ (t >>> 14)) >>> 0) / 4294967296; // Normalize to [0, 1)
    this.prevRandom = result * max;

    return min + result * (max - min);
  },
  move: function(x, y) {
    //this.match.objects[this.objectUsing].pathfind = false;
    this.set("x", this.get("x") + x);
    this.set("y", this.get("y") + y);
  },
  selfDestruct: function() {
    // DO NOT SPLICE! just mark as dead and execute onDeath
    if ("onDeath" in this.cards[this.match.objects[this.objectUsing].cardId]) this.cards[this.match.objects[this.objectUsing].cardId].onDeath(this);
    this.set("dead", true);
  },
  getAliveObjects: function() {
    return this.match.objects.filter((obj) => !obj.dead);
  },
  dealDamage: function(id, damage) {
    const selfCard = this.cards[this.match.objects[this.objectUsing].cardId];
    const targetCard = this.cards[this.match.objects[id].cardId];

    if ("onAttack" in selfCard) damage = selfCard.onAttack(this, damage);
    if ("onDamageTaken" in targetCard) {
      this.switchId(id);
      damage = targetCard.onDamageTaken(this, damage);
    }
    this.match.objects[id].hp -= damage;

    if (this.match.objects[id].hp <= 0) {
      this.switchId(id)
      this.selfDestruct();
      if ("onKill" in selfCard) {
        this.revertId();
        selfCard.onKill(this);
      }
    }
    this.revertId();
  },
  switchId: function(id, whenRevert = this.original) {
    this.original = whenRevert;
    this.objectUsing = id;
  },
  revertId: function() {
    this.objectUsing = this.original;
  },
  emit: function(event, data) {
    this.match.events.push({ event, data, emitter: this.objectUsing });
  }
}

function gameloop(match, cards) {
  game.match = match;
  game.cards = cards;

  for (let i = 0; i < game.match.objects.length; i++) {
    const target = game.match.objects[i];

    if (target.dead) continue;
    game.objectUsing = i;
    game.original = i;

    let inSight = []; // each index has id and distance
    let collisions = []; // each index has id
    const objects = game.match.objects;
    for (let j = 0; j < game.match.objects.length; j++) {
      if (objects[j].dead) continue;
      if (i == j) continue; // dont apply to self

      const distance = Math.hypot(Math.abs(objects[j].x - target.x), Math.abs(objects[j].y - target.y));
      if (distance < (cards[target.cardId].sightrange || cards[target.cardId].size / 2)) {
        inSight.push([j, distance]);

        // now collisions, assume both are circles and not spell
        const notSpell = cards[target.cardId].type != "spell" && cards[objects[j].cardId].type != "spell"
        if (notSpell && distance < (cards[target.cardId].size + cards[objects[j].cardId].size) / 2) {
          // push away
          collisions.push(j);
          let angle = Math.atan2(objects[j].y - target.y, objects[j].x - target.x);
          const overlap = (cards[target.cardId].size + cards[objects[j].cardId].size) / 2 - distance;
          const overlapX = Math.cos(angle) * overlap;
          const overlapY = Math.sin(angle) * overlap;
          if (cards[target.cardId].type == cards[objects[j].cardId].type) {
            // if both are same type
            game.switchId(j)
            game.move(overlapX / 2, overlapY / 2);
            game.revertId(i)
            game.move(-overlapX / 2, -overlapY / 2);
          } else if (cards[target.cardId].type == "troop") {
            // give way to buildings.
            game.move(-overlapX, -overlapY);
          }
        }
      }
    }
    target.collisions = collisions;
    target.inSight = inSight;

    // closest enemy! Pre-calculated for you.
    let closest = [-1, Infinity];
    for (let j = 0; j < inSight.length; j++) {
      if (inSight[j][1] < closest[1] && objects[inSight[j][0]].owner != target.owner) {
        if (cards[objects[inSight[j][0]].cardId].type == "spell") continue;
        if (cards[target.cardId].type == "spell") break;
        closest = inSight[j];
      }
    }

    // boundary check
    const lower = 10 + cards[target.cardId].size / 2;
    const upper = game.match.gridSize * 10 - 10 - cards[target.cardId].size / 2;
    if (target.x < lower) target.x = lower;
    if (target.y < lower) target.y = lower;
    if (target.x > upper) target.x = upper;
    if (target.y > upper) target.y = upper;

    game.closest = closest;
    if (cards[target.cardId].type == "troop") {
      target.pathfind = true;
      target.defaultAI = true;
    }
    if ("onTick" in cards[target.cardId]) cards[target.cardId].onTick(game);

    for (let j = 0; j < game.match.events.length; j++) {
      const event = game.match.events[j];
      if (cards[target.cardId].subscribed.includes(event)) cards[target.cardId][event](game, event.data, event.emitter);
      if (game.match.events[j].emitter == i) game.match.events.splice(j, 1);
    }

    // Default behaviour consists of moving towards the closest enemy and attacking it, and moving along the bridge towards the enemy otherwise.
    if (target.defaultAI && game.closest[0] != -1) {
      closest = game.closest[0];
      target.pathfind = false;
      // move
      const distance = Math.hypot(Math.abs(objects[closest].x - target.x), Math.abs(objects[closest].y - target.y));
      const angle = Math.atan2(objects[closest].y - target.y, objects[closest].x - target.x);
      const speed = cards[target.cardId].speed;

      if (distance > cards[target.cardId].attackrange + (cards[objects[closest].cardId].size + cards[target.cardId].size) / 2) {
        game.move(Math.cos(angle) * speed, Math.sin(angle) * speed);
      } else {
        // attack
        if ((game.match.ticks % (game.match.tickRate * cards[target.cardId].hitspeed)) == 0) game.dealDamage(closest, cards[target.cardId].damage);
      }
    }
    if (target.pathfind) {
      const side = target.owner;
      const percentX = target.x / (game.match.gridSize*10);
      const percentY = target.y / (game.match.gridSize*10);
      const speed = cards[target.cardId].speed;
      let moveX = 0;
      let moveY = 1;
      if (!((percentX >= 0.15 && percentX <= 0.3) || (percentX >= 0.65 && percentX <= 0.8))) {
        if (percentX < 0.5) moveX = -1;
        if (percentX < 0.15) moveX = 1;
        if (percentX > 0.5) moveX = 1;
        if (percentX > 0.8) moveX = -1;
        
        if (percentY >= 0.40 && percentY <= 0.60) moveY = 0;
      } else if (percentY < 0.25 || percentY > 0.75) {
        moveY = 0;
        if (percentX < 0.5) moveX = 1;
        if (percentX > 0.5) moveX = -1;
      }
      if (side == 1) moveY = -moveY;
      let total = Math.hypot(moveX, moveY);
      game.move(moveX * speed / total, moveY * speed / total);
    }
  }
  // one last sweep based on hp so we can label units as dead. If the game is coded right, this should not activate.
  for (let i = 0; i < game.match.objects.length; i++) {
    const target = game.match.objects[i];
    if (!target.dead && target.hp <= 0) {
      target.dead = true;
      if ("onDeath" in cards[target.cardId]) {
        game.objectUsing = i;
        cards[target.cardId].onDeath(game);
      }
      console.log(`[WARNING] A(n) ${target.cardId} died, but without a proper process. This is an unsolved murder mystery!`)
    }
  }

  game.match.ticks++;
  return game.match; // ONLY game.match is permanent.
}

export {
  gameloop,
  game
}