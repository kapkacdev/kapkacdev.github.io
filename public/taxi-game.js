class MainScene extends Phaser.Scene {
    constructor() {
        super({ key: 'MainScene' });

        // Update size: Set game dimensions to match the screen size dynamically
        this.GAME_WIDTH = window.innerWidth;
        this.GAME_HEIGHT = window.innerHeight;

        // Update size: Adjust road width relative to the screen size
        this.ROAD_WIDTH = this.GAME_WIDTH * 0.6;


        this.GRASS_COLOR = 0x2ecc71;
        this.ROAD_COLOR = 0x34495e;
        this.LANE_COLOR = 0xf1c40f;

        // Car physics constants
        this.CAR_ACCELERATION = 0.1;
        this.CAR_DECELERATION = 0.99;
        this.MAX_SPEED = 9;
        this.MIN_SPEED = -2;

        // New steering constants for gradual steering
        this.STEERING_ACCELERATION = 0.005; // How quickly steering builds up
        this.STEERING_DECELERATION = 0.60; // How quickly steering returns to center
        this.BASE_MAX_STEERING = 0.45;    // Maximum steering at lowest speed
        this.MIN_MAX_STEERING = 0.16;     // Maximum steering at highest speed
        this.CURRENT_STEERING = 0; // Track current steering amount
        this.STEERING_SPEED = 0; // Track steering velocity

        this.MAX_TILT = 0.3;

        this.AUTO_STRAIGHTEN_SPEED = 0.003;    // Speed of auto-straightening
        this.STRAIGHTEN_DEADZONE = 0.005;      // Threshold to consider car straight

        this.TURN_SPEED_REDUCTION = 1.0;

        // Update size: Adjust base player position relative to screen height
        this.BASE_PLAYER_Y = this.GAME_HEIGHT * 0.85;

        this.MAX_FORWARD_OFFSET = 30;  // Maximum forward movement

        // Traffic constants
        this.LANE_WIDTH = 150;  // Width of each lane
        this.DETECTION_DISTANCE = 200;  // Distance to check for cars ahead
        this.BASE_SAFE_DISTANCE = 150;  // Distance to maintain between cars
        this.SPEED_DISTANCE_FACTOR = 20;
        this.TRAFFIC_SPAWN_TIME = 1000;  // Spawn a new car every 2 seconds
        this.MIN_TRAFFIC_SPEED = 3;
        this.MAX_TRAFFIC_SPEED = 8;
        this.MIN_TRAFFIC_LIMIT = 5;
        this.MAX_TRAFFIC_LIMIT = 14;
        this.TRAFFIC_LIMIT_CHANGE_TIME = 15000;
        this.currentTrafficLimit = this.MAX_TRAFFIC_LIMIT;
        this.REACTION_DELAY = 700

        this.CAR_DIMENSIONS = {
            'car1': { length: 1.0, width: 1.0 },
            'car2': { length: 1.12, width: 1.0 },
            'car3': { length: 1.0, width: 0.95 },
            'car4': { length: 1.0, width: 1.0 }
        };

        // Vegetation spawning constants
        this.SPAWN_DISTANCE = -200; // Distance above viewport to spawn
        this.DESPAWN_DISTANCE = 800; // Distance below viewport to despawn

        this.lastSpawnLane = -1; // Track the last lane a car is spawned
        this.trafficCars = [];

        this.PIXELS_PER_METER = 45;

        // Scoring constants
        this.SCORE = 0;
        this.DISTANCE = 0;
        this.DISTANCE_MULTIPLIER = 0.02;  // Score points per distance unit
        this.COIN_SCORE = 5;
        this.COIN_SPAWN_DISTANCE = 100;
        this.lastCoinSpawn = 0;

        // Coin animation constants
        this.COIN_TOTAL_FRAMES = 5;
        this.COIN_FRAME_RATE = 10;
        this.COIN_SCALE = 0.3;

        // Track coins
        this.coins = [];
    }

    preload() {
        this.load.image('taxi', 'assets/taxi.png');
        this.load.image('steering-wheel', 'assets/steering-wheel.png');

        // Load traffic car assets
        this.load.image('car1', '/assets/car1.png');
        this.load.image('car2', '/assets/car2.png');
        this.load.image('car3', '/assets/car3.png');
        this.load.image('car4', '/assets/car4.png');

        // Load tree variants
        this.load.image('tree1', '/assets/tree1.png');
        this.load.image('tree2', '/assets/tree2.png');
        this.load.image('tree3', '/assets/tree3.png');
        this.load.image('tree4', '/assets/tree4.png');

        // Load bush variants
        this.load.image('bush1', '/assets/bush1.png');
        this.load.image('bush2', '/assets/bush2.png');

        this.load.on('filecomplete-spritesheet-coin', function (key, type, data) {
            console.log('Coin spritesheet loaded:', { key, type, data });
        });

        this.load.on('loaderror', function (file) {
            console.error('Error loading file:', file.src);
        });

        this.load.spritesheet('coin', '/assets/coin.gif', {
            frameWidth: 180,
            frameHeight: 180
        });
    }

    create() {
        // Font Preload
        WebFont.load({
            custom: {
                families: ['Karmatic Arcade']
            },
            active: () => {
                // Create your text elements here
                const textConfig = {
                    fontFamily: 'Karmatic Arcade',
                    fontSize: '24px',
                    fill: '#ffffff',
                    stroke: '#000000',
                    strokeThickness: 4
                };

            }
        });

        // Create depth layers
        this.backgroundLayer = this.add.layer();
        this.roadLayer = this.add.layer();
        this.bushLayer = this.add.layer();
        this.coinLayer = this.add.layer();
        this.trafficLayer = this.add.layer();
        this.carLayer = this.add.layer();
        this.treeLayer = this.add.layer();
        this.UILayer = this.add.layer();

        // Set layer depths
        this.backgroundLayer.setDepth(0);
        this.roadLayer.setDepth(1);
        this.bushLayer.setDepth(2);
        this.coinLayer.setDepth(2.5);
        this.trafficLayer.setDepth(3);
        this.carLayer.setDepth(4);
        this.treeLayer.setDepth(5);
        this.UILayer.setDepth(6);

        // Create the background (grass)
        this.backgroundLayer.add(
            this.add.rectangle(
                this.GAME_WIDTH / 2,
                this.GAME_HEIGHT / 2,
                this.GAME_WIDTH,
                this.GAME_HEIGHT,
                this.GRASS_COLOR
            )
        );

        // Create the road
        const road = this.add.rectangle(
            this.GAME_WIDTH / 2,
            this.GAME_HEIGHT / 2,
            this.ROAD_WIDTH,
            this.GAME_HEIGHT,
            this.ROAD_COLOR
        );
        this.roadLayer.add(road);

        // Create lane markers for dividing the road into 3 sections
        this.laneMarkers = this.add.group();

        const markerHeight = this.GAME_HEIGHT / 15; // Marker height relative to the screen height
        const markerWidth = this.ROAD_WIDTH / 30; // Marker width relative to the road width
        const gap = markerHeight * 1.5; // Gap between markers for consistent spacing
        const totalHeight = this.GAME_HEIGHT + markerHeight + gap; // Total height to cover

        // Correct placement of lane markers to divide the road into 3 sections
        [1 / 3, 2 / 3].forEach((fraction) => {
            for (let y = -totalHeight; y < totalHeight; y += (markerHeight + gap)) {
                const marker = this.add.rectangle(
                    (this.GAME_WIDTH - this.ROAD_WIDTH) / 2 + fraction * this.ROAD_WIDTH, // X position aligned with road lanes
                    y, // Y position with consistent spacing
                    markerWidth,
                    markerHeight,
                    this.LANE_COLOR
                );
                this.roadLayer.add(marker);
                this.laneMarkers.add(marker);
            }
        });

        // Create vegetation groups
        this.vegetation = this.add.group({
            runChildUpdate: true
        });

        this.trees = [];
        this.bushes = [];

        // Add vegetation on both sides
        this.createRoadSideVegetation();

        // Set up the player's taxi
        this.player = this.add.sprite(
            this.GAME_WIDTH / 2,
            this.GAME_HEIGHT - 100,
            'taxi'
        );
        this.player.setScale(1.0);
        this.player.setOrigin(0.5, 0.5);
        this.carLayer.add(this.player);

        // Initialize car physics properties
        this.carVelocity = 0;
        this.steeringAngle = 0;
        this.carSpeed = 0;

        // Collision
        this.physics.add.collider(
            this.player,
            this.trafficCars,
            this.handleCollision,
            null,
            this
        );

        // Add the animation configuration
        console.log('Creating coin animation...');
        try {
            const anim = this.anims.create({
                key: 'coin-spin',
                frames: this.anims.generateFrameNumbers('coin', {
                    start: 0,
                    end: 5
                }),
                frameRate: 10,
                repeat: -1
            });
            console.log('Animation created successfully:', anim);

            // Log all available animations
            console.log('Available animations:', this.anims.anims.entries);
        } catch (error) {
            console.error('Error creating animation:', error);
        }

        // UI
        // Create score text
        const textConfig = {
            fontFamily: 'Karmatic Arcade',
            fontSize: '24px',
            fill: '#ffffff',
            stroke: '#000000',
            strokeThickness: 4
        };

        this.scoreText = this.add.text(20, 20, 'Score: 0', textConfig);
        this.distanceText = this.add.text(20, 50, 'Distance: 0m', textConfig);
        this.UILayer.add(this.scoreText);
        this.UILayer.add(this.distanceText);

        // Add speedbar 
        this.speedBarBg = this.add.rectangle(
            this.GAME_WIDTH - 50,
            30,
            20,
            100,
            0x333333
        );
        this.speedBarBg.setOrigin(0.5, 0);
        this.UILayer.add(this.speedBarBg);

        this.speedBar = this.add.rectangle(
            this.GAME_WIDTH - 50,
            30,
            20,
            0, // Updated based on speed
            0x00ff00
        );
        this.speedBar.setOrigin(0.5, 0);
        this.UILayer.add(this.speedBar);

        this.speedBar.setDepth(1);
        this.speedBar.setDepth(0);

        // Add steering wheel indicator
        this.steeringWheel = this.add.image(
            this.GAME_WIDTH - 70,
            this.GAME_HEIGHT - 70,
            'steering-wheel'
        );
        this.steeringWheel.setScale(0.15); // Adjust scale as needed
        this.UILayer.add(this.steeringWheel);

        // Enable physics on the player
        this.physics.add.existing(this.player);
        this.player.body.setCollideWorldBounds(true);

        const roadLeftBound = (this.GAME_WIDTH - this.ROAD_WIDTH) / 2;
        // todo: add roadRightBound
        const roadRightBound = roadLeftBound + this.ROAD_WIDTH;

        this.player.body.setBoundsRectangle(new Phaser.Geom.Rectangle(
            roadLeftBound,
            0,
            this.ROAD_WIDTH,
            this.GAME_HEIGHT
        ));

        this.cursors = this.input.keyboard.createCursorKeys();
        this.markerSpeed = 3;
        this.roadScroll = 0;

        this.time.addEvent({
            delay: this.TRAFFIC_SPAWN_TIME,
            callback: this.spawnTrafficCar,
            callbackScope: this,
            loop: true
        });

        this.time.addEvent({
            delay: this.TRAFFIC_LIMIT_CHANGE_TIME,
            callback: this.updateTrafficLimit,
            callbackScope: this,
            loop: true
        });

        // Add touch controls
        this.addTouchControls();
    }


    addTouchControls() {
        // Steering Area: Covers the bottom portion of the screen for interaction
        const steeringArea = this.add.rectangle(
            this.GAME_WIDTH / 2,
            this.GAME_HEIGHT / 2,
            this.GAME_WIDTH,
            this.GAME_HEIGHT,
            0x000000,
            0 // Fully transparent
        ).setInteractive();

        let isSteering = false;
        let lastSteeringX = null;

        // Pointer down: Start accelerating and enable steering
        steeringArea.on('pointerdown', (pointer) => {
            this.isAccelerating = true; // Start accelerating
            isSteering = true;
            lastSteeringX = pointer.x; // Track initial pointer position for steering
        });

        // Pointer move: Adjust steering based on horizontal drag
        steeringArea.on('pointermove', (pointer) => {
            if (isSteering && lastSteeringX !== null) {
                const deltaX = pointer.x - lastSteeringX; // Calculate horizontal movement
                const steeringSensitivity = 0.005; // Adjust sensitivity for steering
                this.STEERING_SPEED = deltaX * steeringSensitivity; // Update steering speed
                lastSteeringX = pointer.x; // Update for continuous movement
            }
        });

        // Pointer up: Stop accelerating and disable steering
        steeringArea.on('pointerup', () => {
            this.isAccelerating = false; // Stop accelerating
            isSteering = false;
            lastSteeringX = null;
            this.STEERING_SPEED = 0; // Reset steering speed when input ends
        });

        // Pointer out: Stop accelerating and reset steering when touch leaves the screen
        steeringArea.on('pointerout', () => {
            this.isAccelerating = false; // Stop accelerating
            isSteering = false;
            lastSteeringX = null;
            this.STEERING_SPEED = 0; // Reset steering speed when input ends
        });
    }


    updateTrafficLimit() {
        // Randomly set new limit between min and max
        this.currentTrafficLimit = Phaser.Math.Between(
            this.MIN_TRAFFIC_LIMIT,
            this.MAX_TRAFFIC_LIMIT
        );
        console.log(`New traffic limit: ${this.currentTrafficLimit}`);
    }

    spawnTrafficCar() {
        // Check if we're at or above the current limit
        if (this.trafficCars.length >= this.currentTrafficLimit) {
            return; // Don't spawn new cars if we're at the limit
        }

        let availableLanes = [0, 1, 2].filter(lane => lane !== this.lastSpawnLane);
        const laneIndex = availableLanes[Phaser.Math.Between(0, availableLanes.length - 1)];
        this.lastSpawnLane = laneIndex;  // Remember this lane for next spawn

        const carAssets = ['car1', 'car2', 'car3', 'car4'];
        const randomCar = carAssets[Phaser.Math.Between(0, carAssets.length - 1)];

        // Calculate lane position
        const laneOffset = this.ROAD_WIDTH / 3;  // Width of each lane
        const roadLeft = (this.GAME_WIDTH - this.ROAD_WIDTH) / 2;
        const baseX = roadLeft + (laneOffset * 0.5) + (laneIndex * laneOffset);

        // Add random offset (adjust the ±15 to taste)
        const randomOffset = Phaser.Math.Between(-15, 15);
        const x = baseX + randomOffset;

        const car = this.add.sprite(x, this.SPAWN_DISTANCE, randomCar);
        car.setScale(1.0);
        car.setOrigin(0.5, 0.5);
        this.physics.add.existing(car);
        this.trafficLayer.add(car);

        // Car properties
        car.speed = Phaser.Math.Between(this.MIN_TRAFFIC_SPEED, this.MAX_TRAFFIC_SPEED);
        car.lane = laneIndex;
        car.desiredSpeed = car.speed;
        car.acceleration = 0.1;
        car.lastSpeedChange = 0;
        car.speedChangeInterval = Phaser.Math.Between(8000, 12000);

        car.body.setSize(car.width * 0.8, car.height * 0.75); // Slightly smaller hitbox
        this.physics.add.existing(car, false);

        this.trafficCars.push(car);
    }

    updateTraffic() {
        const currentTime = this.time.now;

        for (let i = this.trafficCars.length - 1; i >= 0; i--) {
            const car = this.trafficCars[i];

            // Calculate dynamic safe distance based on speed
            const safeDist = this.BASE_SAFE_DISTANCE + (car.speed * this.SPEED_DISTANCE_FACTOR);

            // Update speed cycle
            if (currentTime - car.lastSpeedChange > car.speedChangeInterval) {
                // Only change speed if not currently following another car
                if (!car.isFollowing) {
                    car.desiredSpeed = Phaser.Math.Between(this.MIN_TRAFFIC_SPEED, this.MAX_TRAFFIC_SPEED);
                    car.speedChangeInterval = Phaser.Math.Between(8000, 12000);  // Set new random interval
                }
                car.lastSpeedChange = currentTime;
            }

            // Check for cars ahead
            const carsAhead = this.trafficCars.filter(otherCar => {
                if (otherCar === car) return false;
                if (otherCar.y >= car.y) return false;
                if (car.y - otherCar.y > this.DETECTION_DISTANCE) return false;

                const xDistance = Math.abs(otherCar.x - car.x);
                return xDistance < 50;
            });

            // Check if taxi is ahead
            const playerAhead =
                this.player.y < car.y &&
                car.y - this.player.y < this.DETECTION_DISTANCE &&
                Math.abs(this.player.x - car.x) < 50;

            if (playerAhead || carsAhead.length > 0) {
                car.isFollowing = true;
                let targetVehicle;

                if (playerAhead) {
                    // If player is ahead, use player's data
                    targetVehicle = {
                        y: this.player.y,
                        speed: Math.max(0, this.carSpeed) // Only consider forward speed
                    };
                } else {
                    // Use nearest traffic car
                    targetVehicle = carsAhead.reduce((nearest, current) =>
                        current.y > nearest.y ? current : nearest
                    );
                }

                const distance = car.y - targetVehicle.y;
                const targetSpeed = distance < safeDist
                    ? targetVehicle.speed * 0.9  // Slightly slower than vehicle ahead
                    : car.desiredSpeed;

                // Gradually adjust speed with more aggressive braking when too close
                if (car.speed > targetSpeed) {
                    const brakingFactor = distance < safeDist * 0.5 ? 2.0 : 1.0;
                    car.speed = Math.max(targetSpeed, car.speed - (car.acceleration * brakingFactor));
                } else if (car.speed < targetSpeed) {
                    car.speed = Math.min(targetSpeed, car.speed + car.acceleration);
                }
            } else {
                car.isFollowing = false;
                // Gradually return to desired speed
                if (car.speed < car.desiredSpeed) {
                    car.speed = Math.min(car.desiredSpeed, car.speed + car.acceleration);
                } else if (car.speed > car.desiredSpeed) {
                    car.speed = Math.max(car.desiredSpeed, car.speed - car.acceleration);
                }
            }

            // Move car relative to player speed
            car.y += -(car.speed - this.carVelocity);

            // Remove car if it's off screen
            if (car.y > this.DESPAWN_DISTANCE) {
                car.destroy();
                this.trafficCars.splice(i, 1);
            }
        }
    }

    handleCollision(player, trafficCar) {
        // Stop the game physics
        this.physics.pause();

        // Show browser alert
        alert('Crash! Game Over!');

        // Reload the game
        location.reload();
    }

    spawnCoin() {
        // Calculate lane positions
        const laneWidth = this.ROAD_WIDTH / 3;
        const roadLeft = (this.GAME_WIDTH - this.ROAD_WIDTH) / 2;

        // Choose random lane
        const laneIndex = Phaser.Math.Between(0, 2);
        const x = roadLeft + (laneWidth * 0.5) + (laneIndex * laneWidth);

        console.log('Spawning coin...');
        const coin = this.add.sprite(x, this.SPAWN_DISTANCE, 'coin');

        // Log sprite details
        console.log('Coin sprite created:', {
            texture: coin.texture.key,
            frame: coin.frame.name,
            hasAnimation: coin.anims !== undefined,
            textureExists: this.textures.exists('coin')
        });

        try {
            coin.anims.play('coin-spin');
            console.log('Animation started successfully');
        } catch (error) {
            console.error('Error playing animation:', error);
        }

        coin.setScale(this.COIN_SCALE);

        // Add to physics system
        this.physics.add.existing(coin);
        coin.body.setSize(coin.width * 0.8, coin.height * 0.8);  // Smaller hitbox

        this.coinLayer.add(coin);
        this.coins.push(coin);

        // Add overlap detection with player
        this.physics.add.overlap(this.player, coin, this.collectCoin, null, this);
    }

    collectCoin(player, coin) {
        // Remove coin
        const index = this.coins.indexOf(coin);
        if (index > -1) {
            this.coins.splice(index, 1);
        }
        coin.destroy();

        // Add score
        this.SCORE += this.COIN_SCORE;
        this.updateScoreText();

        // Optional: Add collection effect
        this.tweens.add({
            targets: coin,
            alpha: 0,
            scale: 1.5,
            duration: 200,
            onComplete: () => coin.destroy()
        });
    }

    createRoadSideVegetation() {
        const roadCenter = this.GAME_WIDTH / 2;
        const roadEdge = this.ROAD_WIDTH / 2;

        // Create more initial vegetation to fill the scene
        this.createVegetationLayer(roadCenter - roadEdge - 150, -8, 8, 'left');
        this.createVegetationLayer(roadCenter + roadEdge + 150, -8, 8, 'right');
    }

    createVegetationLayer(baseX, startY, count, side) {
        const treeTypes = ['tree1', 'tree2', 'tree3', 'tree4'];
        const bushTypes = ['bush1', 'bush2'];

        for (let i = startY; i < count; i++) {
            const xOffset = Phaser.Math.Between(-30, 30);
            const ySpacing = 250;
            const y = i * ySpacing + this.SPAWN_DISTANCE;

            // Add bushes
            if (Phaser.Math.Between(0, 10) > 3) {
                const bushType = bushTypes[Phaser.Math.Between(0, bushTypes.length - 1)];
                const bush = this.add.image(baseX + xOffset, y, bushType);
                const scale = Phaser.Math.FloatBetween(0.4, 0.5);
                bush.setScale(scale);
                bush.initialX = baseX; // Store initial X for recycling
                this.bushLayer.add(bush);
                this.bushes.push(bush);
                this.vegetation.add(bush);
            }

            // Add trees
            if (Phaser.Math.Between(0, 10) > 4) {
                const treeType = treeTypes[Phaser.Math.Between(0, treeTypes.length - 1)];
                const tree = this.add.image(baseX + xOffset, y, treeType);
                const scale = Phaser.Math.FloatBetween(0.4, 0.5);
                tree.setScale(scale);
                tree.initialX = baseX; // Store initial X for recycling

                // Calculate the root position
                tree.rootY = y + (tree.height * scale / 2);
                this.updateTreeDepth(tree);

                this.treeLayer.add(tree);
                this.trees.push(tree);
                this.vegetation.add(tree);
            }
        }

        // Sort trees by Y position for proper depth
        this.sortTrees();
    }

    updateTreeDepth(tree) {
        // Set depth based on Y position
        // Multiply by 100 to ensure enough depth resolution
        tree.setDepth(tree.rootY * 100);
    }

    sortTrees() {
        // Sort trees array by Y position
        this.trees.sort((a, b) => a.rootY - b.rootY);

        // Update depths to ensure proper ordering
        this.trees.forEach((tree, index) => {
            tree.setDepth(index * 100);
        });
    }

    updateCarPhysics() {
        // Handle keyboard input for acceleration and braking
        if (this.cursors.up.isDown || this.isAccelerating) {
            this.carSpeed += this.CAR_ACCELERATION;
        } else if (this.cursors.down.isDown || this.isBraking) {
            this.carSpeed -= this.CAR_ACCELERATION;
        } else {
            // Apply deceleration when no input is provided
            this.carSpeed *= this.CAR_DECELERATION;
            if (Math.abs(this.carSpeed) < 0.1) this.carSpeed = 0;
        }

        // Clamp car speed to its min and max values
        this.carSpeed = Phaser.Math.Clamp(this.carSpeed, this.MIN_SPEED, this.MAX_SPEED);

        // Handle keyboard input for steering
        if (this.cursors.left.isDown) {
            this.STEERING_SPEED -= this.STEERING_ACCELERATION * Math.abs(this.carSpeed / this.MAX_SPEED);
        } else if (this.cursors.right.isDown) {
            this.STEERING_SPEED += this.STEERING_ACCELERATION * Math.abs(this.carSpeed / this.MAX_SPEED);
        }

        // Handle touch input for steering (updated by touch events in addTouchControls)
        const currentMaxSteering = this.calculateMaxSteering();

        if (this.STEERING_SPEED === 0) {
            // Auto-straighten if no steering input
            if (Math.abs(this.CURRENT_STEERING) > this.STRAIGHTEN_DEADZONE) {
                const straightenForce = -Math.sign(this.CURRENT_STEERING) *
                    this.AUTO_STRAIGHTEN_SPEED *
                    Math.abs(this.carSpeed / this.MAX_SPEED);
                this.CURRENT_STEERING += straightenForce;
            } else {
                this.CURRENT_STEERING = 0; // Reset to center when almost straight
            }
        } else {
            // Adjust steering speed based on current velocity
            this.CURRENT_STEERING = Phaser.Math.Clamp(
                this.CURRENT_STEERING + this.STEERING_SPEED,
                -currentMaxSteering,
                currentMaxSteering
            );
        }

        // Apply steering effects if the car is moving
        if (Math.abs(this.carSpeed) > 0.1) {
            const targetRotation = this.CURRENT_STEERING * (this.carSpeed / this.MAX_SPEED);
            const tiltAmount = this.CURRENT_STEERING * this.MAX_TILT;

            // Rotate and tilt the car smoothly
            this.player.rotation = Phaser.Math.Linear(this.player.rotation, targetRotation, 0.2);
            this.player.x += this.CURRENT_STEERING * this.carSpeed * 2;

            // Apply a tilt effect visually
            const tiltScale = 1.0 + Math.abs(tiltAmount * 0.3);
            this.player.setScale(1.0, tiltScale);

            // Slightly reduce speed during sharp turns
            if (Math.abs(this.CURRENT_STEERING) > this.BASE_MAX_STEERING / 2) {
                this.carSpeed *= this.TURN_SPEED_REDUCTION;
            }
        }

        // Update steering wheel visual (if applicable)
        const wheelRotation = this.CURRENT_STEERING * 10;
        this.steeringWheel.setRotation(wheelRotation);

        // Update car velocity
        this.carVelocity = this.carSpeed;

        // Update forward offset based on speed
        const speedRatio = Math.abs(this.carSpeed) / this.MAX_SPEED;
        const forwardOffset = speedRatio * this.MAX_FORWARD_OFFSET;

        // Adjust player Y position to create a dynamic speed effect
        this.player.y = this.BASE_PLAYER_Y - forwardOffset;

        // Update speed bar UI (optional)
        this.updateSpeedIndicator();
    }


    calculateMaxSteering() {
        // Calculate dynamic max steering based on speed
        const speedRatio = Math.abs(this.carSpeed) / this.MAX_SPEED;
        return Phaser.Math.Linear(
            this.BASE_MAX_STEERING,
            this.MIN_MAX_STEERING,
            speedRatio
        );
    }

    updateScoreText() {
        // Clear existing text by setting it
        this.scoreText.setText(`Score: ${Math.floor(this.SCORE)}`);
        this.distanceText.setText(`Distance: ${Math.floor(this.DISTANCE)}m`);

        // Force a refresh of the text objects
        this.scoreText.dirty = true;
        this.distanceText.dirty = true;
    }

    updateSpeedIndicator() {
        // Calculate speed percentage
        const speedPercent = Math.abs(this.carSpeed) / this.MAX_SPEED;

        // Update speed bar height
        const maxHeight = 96;
        this.speedBar.height = speedPercent * maxHeight;

        // Update speed bar color based on speed
        const color = Phaser.Display.Color.Interpolate.ColorWithColor(
            Phaser.Display.Color.ValueToColor(0x00ff00),
            Phaser.Display.Color.ValueToColor(0xff0000),
            100,
            speedPercent * 100
        );
        this.speedBar.setFillStyle(Phaser.Display.Color.GetColor(color.r, color.g, color.b));

    }

    updateRoadElements() {
        this.roadScroll += this.carVelocity;

        // Update lane markers
        this.laneMarkers.getChildren().forEach(marker => {
            marker.y += this.carVelocity;
            if (marker.y > this.GAME_HEIGHT + marker.height) {
                marker.y = -marker.height;
            }
        });

        // Update vegetation
        this.vegetation.getChildren().forEach(plant => {
            plant.y += this.carVelocity;

            // Check if plant has moved beyond despawn point
            if (plant.y > this.DESPAWN_DISTANCE) {
                // Reset to spawn position with slight randomization
                plant.y = this.SPAWN_DISTANCE + Phaser.Math.Between(-20, 20);
                plant.x = plant.initialX + Phaser.Math.Between(-30, 30);

                // Update tree depth when recycling
                if (this.trees.includes(plant)) {
                    plant.rootY = plant.y + (plant.height * plant.scale / 2);
                    this.updateTreeDepth(plant);
                    this.sortTrees();
                }
            }
        });
    }

    update() {
        this.updateCarPhysics();
        this.updateRoadElements();
        this.updateTraffic();

        // Update distance and score
        if (this.carSpeed > 0) {
            const distanceDelta = this.carSpeed / this.PIXELS_PER_METER;  // Convert to meters
            this.DISTANCE += distanceDelta;
            this.SCORE += distanceDelta * this.DISTANCE_MULTIPLIER;  // 1 point per 50 meters
        }

        // Check if it's time to spawn a new coin
        if (this.DISTANCE - this.lastCoinSpawn >= this.COIN_SPAWN_DISTANCE) {
            this.spawnCoin();
            this.lastCoinSpawn = this.DISTANCE;
        }

        // Update coins
        for (let i = this.coins.length - 1; i >= 0; i--) {
            const coin = this.coins[i];
            coin.y += this.carVelocity;

            // Remove coins that are off screen
            if (coin.y > this.DESPAWN_DISTANCE) {
                this.coins.splice(i, 1);
                coin.destroy();
            }
        }

        this.updateScoreText();
    }
}

const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    width: window.innerWidth,
    height: window.innerHeight,
    scale: {
        mode: Phaser.Scale.FIT, // Ensures the game fits the screen
        autoCenter: Phaser.Scale.CENTER_BOTH, // Centers the game on the screen
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 },
            debug: false
        }
    },
    scene: MainScene
};

window.addEventListener('load', () => {
    const game = new Phaser.Game(config);
});

window.addEventListener('message', (event) => {
    // Validate the origin of the message
    if (event.origin !== window.location.origin) return;

    const { type, payload } = event.data;

    if (type === 'START_GAME') {
        // Handle the start game event
        console.log('Start game received:', payload);
    }

    // Add more event handlers as needed
});