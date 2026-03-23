import * as THREE from './three';
import { NPC } from './npc';

export class Genome {
    constructor() {
        this.jumpFrequency = Math.random() * 3 + 1; // 1 to 4 seconds
        this.ballThrowPower = Math.random() * 40 + 20; // 20 to 60 velocity multiplier
        this.ballThrowFrequency = Math.random() * 4 + 1; // 1 to 5 seconds
        this.targetSelectionRadius = Math.random() * 20 + 10; // 10 to 30 units
        this.enemyAvoidanceDistance = Math.random() * 10 + 5; // 5 to 15 units
        this.movementSpeedMultiplier = Math.random() * 2 + 1; // 1 to 3 multiplier
    }

}

export class Population {
    constructor(size, scene) {
        this.genomes = [];
        for (let i = 0; i < size; i++) {
            this.genomes.push(new Genome());
        }
    }
    mutate(genome) {
        const mutationRate = 0.3; // 10% chance to mutate each gene
        if (Math.random() < mutationRate) genome.jumpFrequency = Math.random() * 3 + 1;
        if (Math.random() < mutationRate) genome.ballThrowPower = Math.random() * 40 + 20;
        if (Math.random() < mutationRate) genome.ballThrowFrequency = Math.random() * 4 + 1;
        if (Math.random() < mutationRate) genome.targetSelectionRadius = Math.random() * 20 + 10;
        if (Math.random() < mutationRate) genome.enemyAvoidanceDistance = Math.random() * 10 + 5;
        if (Math.random() < mutationRate) genome.movementSpeedMultiplier = Math.random() * 2 + 1;
    }
    crossover(parentA, parentB) {
        const child = new Genome();
        child.jumpFrequency = Math.random() < 0.5 ? parentA.jumpFrequency : parentB.jumpFrequency;
        child.ballThrowPower = Math.random() < 0.5 ? parentA.ballThrowPower : parentB.ballThrowPower;
        child.ballThrowFrequency = Math.random() < 0.5 ? parentA.ballThrowFrequency : parentB.ballThrowFrequency;
        child.targetSelectionRadius = Math.random() < 0.5 ? parentA.targetSelectionRadius : parentB.targetSelectionRadius;
        child.enemyAvoidanceDistance = Math.random() < 0.5 ? parentA.enemyAvoidanceDistance : parentB.enemyAvoidanceDistance;
        child.movementSpeedMultiplier = Math.random() < 0.5 ? parentA.movementSpeedMultiplier : parentB.movementSpeedMultiplier;
        return child;
    }
    evaluateFitness(npc, targets, enemies) {
        let fitness = 0;
        const npcCenter = npc.getCenter();
        // Example fitness calculation (replace with actual logic)
        fitness += npc.timeSurvived;
        fitness += npc.targetsHit * 10;
        fitness += npc.framesSafeDistance;
        return fitness;
    }
    selectParents() {
        // Implement selection logic (e.g., tournament selection, roulette wheel)
        // For simplicity, we'll just return two random genomes here
        const parentA = this.genomes[Math.floor(Math.random() * this.genomes.length)];
        const parentB = this.genomes[Math.floor(Math.random() * this.genomes.length)];
        return [parentA, parentB];
    }
    evolveGeneration(npc, targets, enemies) {
        // Evaluate fitness of all genomes
        const fitnessScores = this.genomes.map(genome => this.evaluateFitness(npc, targets, enemies));
    }
}