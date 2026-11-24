// Max: movement, jump feel (coyote time, jump buffer, variable height) and animation.
// Input comes from any number of control sources (keyboard, touch pad).
import Phaser from 'phaser';
import type { ControlSource } from '../ui/keyboard';

export const MOVE = {
  gravity: 1400,
  run: 260,
  jump: -620,
  coyoteMs: 100,
  bufferMs: 100,
} as const;

/** Events: 'jump', 'land' (fallSpeed: number). */
export class Max extends Phaser.Physics.Arcade.Sprite {
  declare body: Phaser.Physics.Arcade.Body;
  private lastGround = -Infinity;
  private lastJumpPress = -Infinity;
  private prevJumpHeld = false;
  private rising = false;
  private wasOnGround = false;
  private prevVy = 0;
  frozen = false;

  constructor(scene: Phaser.Scene, x: number, y: number, private controls: ControlSource[]) {
    super(scene, x, y, 'max-idle');
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.body.setSize(26, 66).setOffset(19, 11);
    this.body.setMaxVelocityY(1100);
    if (!scene.anims.exists('max-run')) {
      scene.anims.create({
        key: 'max-run',
        frames: [0, 1, 2, 3].map((i) => ({ key: `max-run-${i}` })),
        frameRate: 12,
        repeat: -1,
      });
    }
  }

  get onGround(): boolean {
    return this.body.blocked.down || this.body.touching.down;
  }

  /** Put Max back on his feet at (x, y) with no momentum. */
  placeAt(x: number, y: number): void {
    this.body.reset(x, y);
    this.lastGround = this.lastJumpPress = -Infinity;
    this.rising = false;
  }

  tick(time: number, delta: number): void {
    const body = this.body;
    const left = this.controls.some((c) => c.left());
    const right = this.controls.some((c) => c.right());
    const jumpHeld = this.controls.some((c) => c.jump());
    const onGround = this.onGround;

    if (onGround) this.lastGround = time;
    if (jumpHeld && !this.prevJumpHeld) this.lastJumpPress = time;
    this.prevJumpHeld = jumpHeld;

    const dir = this.frozen ? 0 : (right ? 1 : 0) - (left ? 1 : 0);
    // Snappy on the ground, a little floaty in the air. Frame-rate independent.
    const k = onGround ? 0.4 : 0.2;
    const f = 1 - Math.pow(1 - k, delta / (1000 / 60));
    body.setVelocityX(body.velocity.x + (dir * MOVE.run - body.velocity.x) * f);
    if (dir !== 0) this.setFlipX(dir < 0);

    const canJump = time - this.lastGround <= MOVE.coyoteMs;
    if (!this.frozen && time - this.lastJumpPress <= MOVE.bufferMs && canJump) {
      body.setVelocityY(MOVE.jump);
      this.lastJumpPress = this.lastGround = -Infinity;
      this.rising = true;
      this.emit('jump');
    }
    // Let go early for a short hop.
    if (this.rising && (!jumpHeld || body.velocity.y >= 0)) {
      if (body.velocity.y < 0) body.setVelocityY(body.velocity.y * 0.45);
      this.rising = false;
    }

    if (onGround && !this.wasOnGround && this.prevVy > 250) this.emit('land', this.prevVy);
    this.wasOnGround = onGround;
    this.prevVy = body.velocity.y;

    if (!onGround) {
      this.anims.stop();
      this.setTexture('max-jump');
    } else if (Math.abs(body.velocity.x) > 30) {
      this.anims.play('max-run', true);
    } else {
      this.anims.stop();
      this.setTexture('max-idle');
    }
  }
}
