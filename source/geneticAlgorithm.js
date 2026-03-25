import * as THREE from 'three';
import { NPC } from './npc';

export class Genome {
    constructor() {
        this.jumpFrequency = roundTo(Math.random() * 3 + 2, 2); // 2 to 5 seconds
        this.ballThrowPower = roundTo(Math.random() * 40 + 30, 2); // 20 to 70 velocity multiplier
        this.ballThrowFrequency = roundTo(Math.random() * 4 + 3, 2); // 3 to 7 seconds
        this.targetSelectionRadius = roundTo(Math.random() * 30 + 15, 2); // 15 to 45 units
        this.enemyAvoidanceDistance = roundTo(Math.random() * 8 + 7, 2); // 7 to 15 units
        this.movementSpeedMultiplier = roundTo(Math.random() + 1, 2); // 1 to 2 multiplier
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
    evaluateFitness(roundMetrics) {
        /*let fitness = 0;
        const npcCenter = npc.getCenter();
        // Example fitness calculation (replace with actual logic)
        fitness += npc.timeSurvived;
        fitness += npc.targetsHit * 10;
        fitness += npc.framesSafeDistance;
        return fitness;*/
        /*let fitness = 0;
        roundMetrics.forEach(r => {
            fitness += r.npc.timeSurvived * 0.2;
            fitness += r.npc.targetsHit * 3;
            fitness += (r.npc.framesSafeDistance / r.npc.totalFrames) * 20;
            fitness += 1 / (1 + r.npc.avgActionLatency) * 10;
            fitness -= Math.abs(r.npc.measuredJumpFrequency - 1.5) * 2;
        });
        return fitness;*/
        let fitness = 0;
        return fitness;
    }
}

export class Population {
    constructor(size) {
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
    evaluateFitness(roundMetrics) {
        let fitness = 0;
        //const npcCenter = npc.getCenter();
        // Example fitness calculation (replace with actual logic)
        //fitness += npc.timeSurvived;
        //fitness += npc.targetsHit * 10;
        //fitness += npc.framesSafeDistance;
        return fitness;
    }
    selectParents() {
        // Implement selection logic (e.g., tournament selection, roulette wheel)
        // For simplicity, we'll just return two random genomes here
        const parentA = this.genomes[Math.floor(Math.random() * this.genomes.length)];
        const parentB = this.genomes[Math.floor(Math.random() * this.genomes.length)];
        return [parentA, parentB];
    }
    evolveGeneration() {
        // Evaluate fitness of all genomes
        //const fitnessScores = this.genomes.map(genome => this.evaluateFitness(npc, targets, enemies));
    }
}
function roundTo(num, dec) {
  const factor = Math.pow(10, dec);
  return Math.round(num * factor) / factor;
}