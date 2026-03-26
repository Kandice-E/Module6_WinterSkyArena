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
        const competitiveWeight = 0.3;
        const closenessWeight = 0.25;
        const adaptabilityWeight = 0.20;
        const behavioralWeight = 0.15;
        const responsivenessWeight = 0.10;
        // FITNESS COMPONENT 1: [0, 1]
        const competitiveRatio = Math.min(npcStats.score / 
            Math.max(1, playerStats.score), 1.5);
        const competitiveTerm = competitiveRatio / 1.5;
        // FITNESS COMPONENT 2: [0, 1]
        const scoreDiff = Math.abs(npcStats.score - playerStats.score);
        const closenessTerm = Math.max(0, (100 - scoreDiff * 2) / 100);
        // FITNESS COMPONENT 3: [0, 1]
        const scoreRatio = 0.5 * (npcStats.score / npcStats.timeSurvived) + 0.5 * (npcStats.score / (npcStats.score + playerStats.score));
        const scoreRatioExpec = 0.5 * (playerStats.score / playerStats.timeSurvived) + 0.5 * (playerStats.score / (playerStats.score + npcStats.score)); 
        let adaptabilityTerm = Math.max(0, (100 - Math.abs((scoreRatio * 100) - (scoreRatioExpec * 100))) / 100);
        // FITNESS COMPONENT 4: [0, 1]
        const accuracy =  (npcStats.targetsHit / Math.max(1, npcStats.ballsThrown)) * 100;
        const avoidance = (npcStats.framesSafeDistance / npcStats.totalFrames) * 100;
        let behavioralTerm = (accuracy + avoidance) / 200;
        // FITNESS COMPONENT 5: [0, 1]
        const latencyScore = Math.max(0, 100 - npcStats.avgActionLatency * 10);
        const jumpScore = Math.max(0, 100 - Math.abs(npcStats.measuredJumpFrequency - playerStats.jumpFrequency));
        const turnScore = Math.min(0, 100 - Math.abs(npcStats.turnSpeed - playerStats.turnSpeed) * 5);
        let responsivenessTerm = (latencyScore + jumpScore + turnScore) / 300;
        // FINAL WEIGHTED FITNESS: [0, 5]
        const fitness = 
        (competitiveWeight * competitiveTerm) +
        (closenessWeight * closenessTerm) +
        (adaptabilityWeight * adaptabilityTerm) +
        (behavioralWeight * behavioralTerm) +
        (responsivenessWeight * responsivenessTerm);
        return fitness * 5; // Range: [0, 5]
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
        const competitiveWeight = 0.3;
        const closenessWeight = 0.25;
        const adaptabilityWeight = 0.20;
        const behavioralWeight = 0.15;
        const responsivenessWeight = 0.10;
        // FITNESS COMPONENT 1: [0, 1]
        const competitiveRatio = Math.min(npcStats.score / 
            Math.max(1, playerStats.score), 1.5);
        const competitiveTerm = competitiveRatio / 1.5;
        // FITNESS COMPONENT 2: [0, 1]
        const scoreDiff = Math.abs(npcStats.score - playerStats.score);
        const closenessTerm = Math.max(0, (100 - scoreDiff * 2) / 100);
        // FITNESS COMPONENT 3: [0, 1]
        const scoreRatio = 0.5 * (npcStats.score / npcStats.timeSurvived) + 0.5 * (npcStats.score / (npcStats.score + playerStats.score));
        const scoreRatioExpec = 0.5 * (playerStats.score / playerStats.timeSurvived) + 0.5 * (playerStats.score / (playerStats.score + npcStats.score)); 
        let adaptabilityTerm = Math.max(0, (100 - Math.abs((scoreRatio * 100) - (scoreRatioExpec * 100))) / 100);
        // FITNESS COMPONENT 4: [0, 1]
        const accuracy =  (npcStats.targetsHit / Math.max(1, npcStats.ballsThrown)) * 100;
        const avoidance = (npcStats.framesSafeDistance / npcStats.totalFrames) * 100;
        let behavioralTerm = (accuracy + avoidance) / 200;
        // FITNESS COMPONENT 5: [0, 1]
        const latencyScore = Math.max(0, 100 - npcStats.avgActionLatency * 10);
        const jumpScore = Math.max(0, 100 - Math.abs(npcStats.measuredJumpFrequency - playerStats.jumpFrequency));
        const turnScore = Math.min(0, 100 - Math.abs(npcStats.turnSpeed - playerStats.turnSpeed) * 5);
        let responsivenessTerm = (latencyScore + jumpScore + turnScore) / 300;
        // FINAL WEIGHTED FITNESS: [0, 5]
        const fitness = 
        (competitiveWeight * competitiveTerm) +
        (closenessWeight * closenessTerm) +
        (adaptabilityWeight * adaptabilityTerm) +
        (behavioralWeight * behavioralTerm) +
        (responsivenessWeight * responsivenessTerm);
        return fitness * 5; // Range: [0, 5]
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