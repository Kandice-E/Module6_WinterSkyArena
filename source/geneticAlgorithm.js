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
        this.fitness = 0;
        this.evaluations = 0;
        this.metrics = {
            competitive: 0,
            closeness: 0,
            adaptability: 0,
            behavioral: 0,
            responsiveness: 0
        };
    }
}
const GENE_RANGES = {
            jumpFrequency: { min: 2, max: 5 },
            ballThrowPower: { min: 30, max: 70 },
            ballThrowFrequency: { min: 3, max: 7 },
            targetSelectionRadius: { min: 15, max: 45 },
            enemyAvoidanceDistance: { min: 7, max: 15 },
            movementSpeedMultiplier: { min: 1, max: 2 }
        }
export class Population {
    constructor(size) {
        this.genomes = [];
        for (let i = 0; i < size; i++) {
            this.genomes.push(new Genome());
        }
        this.fitnessScores = [];
    }
    mutate(genome) {
        const mutationRate = 0.3; // 30% chance to mutate each gene
        const noiseStdDev = 0.1;  // 10% of range

        Object.keys(GENE_RANGES).forEach(key => {
            if (Math.random() < mutationRate) {
                const {min, max} = GENE_RANGES[key];
                const range = max - min;
                const noise = gaussianRandom(0, noiseStdDev * range);
                genome[key] += noise;
                //Clamp to range
                genome[key] = Math.max(min, Math.min(max, genome[key]));
            }
        });
        //if (Math.random() < mutationRate) genome.jumpFrequency = Math.random() * 3 + 1;
        //if (Math.random() < mutationRate) genome.ballThrowPower = Math.random() * 40 + 20;
        //if (Math.random() < mutationRate) genome.ballThrowFrequency = Math.random() * 4 + 1;
        //if (Math.random() < mutationRate) genome.targetSelectionRadius = Math.random() * 20 + 10;
        //if (Math.random() < mutationRate) genome.enemyAvoidanceDistance = Math.random() * 10 + 5;
        //if (Math.random() < mutationRate) genome.movementSpeedMultiplier = Math.random() * 2 + 1;
    }
    crossover(parentA, parentB) {
        const child = new Genome();
        const alpha = 0.3;

        Object.keys(GENE_RANGES).forEach(key => {
            const p1 = parentA[key];
            const p2 = parentB[key];
            const minVal = Math.min(p1, p2);
            const maxVal = Math.max(p1, p2);
            const diff = maxVal - minVal;

            const rangeMin = minVal - alpha * diff;
            const rangeMax = maxVal + alpha * diff;

            child[key] = Math.random() * (rangeMax - rangeMin) + rangeMin;
            //Clamp to gene range
            const {min, max} = GENE_RANGES[key];
            child[key] = Math.max(min, Math.min(max, child[key]));
        });
        //child.jumpFrequency = Math.random() < 0.5 ? parentA.jumpFrequency : parentB.jumpFrequency;
        //child.ballThrowPower = Math.random() < 0.5 ? parentA.ballThrowPower : parentB.ballThrowPower;
        //child.ballThrowFrequency = Math.random() < 0.5 ? parentA.ballThrowFrequency : parentB.ballThrowFrequency;
        //child.targetSelectionRadius = Math.random() < 0.5 ? parentA.targetSelectionRadius : parentB.targetSelectionRadius;
        //child.enemyAvoidanceDistance = Math.random() < 0.5 ? parentA.enemyAvoidanceDistance : parentB.enemyAvoidanceDistance;
        //child.movementSpeedMultiplier = Math.random() < 0.5 ? parentA.movementSpeedMultiplier : parentB.movementSpeedMultiplier;
        return child;
    } //-----START HERE WITH UPDATES-----//
    //-----Refactor fitness evaluation to be done on each genome in the population-----//
    evaluateFitness(roundMetrics) {
        const weights = {
            competitive: 0.3,
            closeness: 0.25,
            adaptability: 0.2,
            behavioral: 0.15,
            responsiveness: 0.1
        };
        //const competitiveWeight = 0.3;
        //const closenessWeight = 0.25;
        //const adaptabilityWeight = 0.20;
        //const behavioralWeight = 0.15;
        //const responsivenessWeight = 0.10;
        //Start by identifying and storing each genome's metrics
        for (let g = 0; g < this.genomes.length; g++) {
            const genomeMetrics = roundMetrics.filter(m => m.genomeIndex === g);
            //Skip if no metrics collected this round
            if (roundMetrics.length === 0) continue;
            //Compute average terms across the rounds for this genome
            let avgComponents = {
                competitive: 0,
                closeness: 0,
                adaptability: 0,
                behavioral: 0,
                responsiveness:0
            };
            //REMOVE THIS LINE AFTER DONE REFACTORING
            //let fitness = 0;
            genomeMetrics.forEach(r => {
            const npcStats = r.npc;
            const playerStats = r.player;
            // FITNESS COMPONENT 1: [0, 1]
            const competitiveRatio = Math.min(npcStats.score / 
            Math.max(1, playerStats.score), 1.5);
            //const competitiveTerm = competitiveRatio / 1.5;
            avgComponents.competitive += competitiveRatio / 1.5;
            // FITNESS COMPONENT 2: [0, 1]
            const scoreDiff = Math.abs(npcStats.score - playerStats.score);
            //const closenessTerm = Math.max(0, (100 - scoreDiff * 2) / 100);
            avgComponents.closeness += Math.max(0, (100 - scoreDiff * 2) / 100);
            // FITNESS COMPONENT 3: [0, 1]
            const scoreRatio = 0.5 * (npcStats.score / npcStats.timeSurvived) + 0.5 * (npcStats.score / (npcStats.score + playerStats.score));
            const scoreRatioExpec = 0.5 * (playerStats.score / playerStats.timeSurvived) + 0.5 * (playerStats.score / (playerStats.score + npcStats.score)); 
            //let adaptabilityTerm = Math.max(0, (100 - Math.abs((scoreRatio * 100) - (scoreRatioExpec * 100))) / 100);
            avgComponents.adaptability += Math.max(0, (100 - Math.abs((scoreRatio * 100) - (scoreRatioExpec * 100))) / 100);
            // FITNESS COMPONENT 4: [0, 1]
            const accuracy =  (npcStats.targetsHit / Math.max(1, npcStats.ballsThrown)) * 100;
            const avoidance = (npcStats.framesSafeDistance / npcStats.totalFrames) * 100;
            //let behavioralTerm = (accuracy + avoidance) / 200;
            avgComponents.behavioral += (accuracy + avoidance) / 200;
            // FITNESS COMPONENT 5: [0, 1]
            const latencyScore = Math.max(0, 100 - npcStats.avgActionLatency * 10);
            const jumpScore = Math.max(0, 100 - Math.abs(npcStats.measuredJumpFrequency - playerStats.jumpFrequency));
            const turnScore = Math.min(0, 100 - Math.abs(npcStats.turnSpeed - playerStats.turnSpeed) * 5);
            //let responsivenessTerm = (latencyScore + jumpScore + turnScore) / 300;
            avgComponents.responsiveness += (latencyScore + jumpScore + turnScore) / 300;
            // FINAL WEIGHTED FITNESS: [0, 5]
            //fitness = (competitiveWeight * competitiveTerm) +
              //         (closenessWeight * closenessTerm) +
                //       (adaptabilityWeight * adaptabilityTerm) +
                  //     (behavioralWeight * behavioralTerm) +
                    //   (responsivenessWeight * responsivenessTerm);
            
            });
            //Divide by number of rounds to get average
            for (let key in avgComponents) {
                avgComponents[key] /= roundMetrics.length;
            }
            //Alpha Rolling Fitness (EMA)
            const alpha = 0.4;
            const genome = this.genomes[g];
            
            if (!genome.metrics) {
                genome.metrics = avgComponents;
                genome.evaluations = 1;
            } else {
                for (let key in avgComponents) {
                    genome.metrics[key] = (1- alpha) * genome.metrics[key] + alpha * avgComponents[key];
                }
                genome.evaluations++;
            }
            //Recompute Weighted Total Fitness
            let totalFitness = 0;
            for (let key in genome.metrics) {
                totalFitness += genome.metrics[key] * weights[key];
            }
            //Store In Population Object For Reference
            genome.fitness = totalFitness * 5;
            this.fitnessScores[g] = genome.fitness;
            //this.fitnessScores[g] = genomeMetrics.length > 0 ? fitness * 5 : 0;
        }//REMOVE BELOW ONCE TESTED THE ABOVE SETUP
        /*
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
        (responsivenessWeight * responsivenessTerm);*/
        //return fitness * 5; // Range: [0, 5]
    }
    findLowestFitnessIndex() {
        const kPercent = 0.2;
        const k = Math.max(1, Math.floor(this.length * kPercent));
        let lowestIndex = 0;
        //let lowestFitness = this.fitnessScores[0];
        //Sort by fitness ascending worst to best
        const sortedFitness = this.map((_, i) => i)
        .sort((a,b) => this.genomes[a].fitness - this.genomes[b].fitness);
        //Take indices of worst k%
        const worstPool = sortedFitness.slice(0, k);
        //Pick a random index from the worst pool
        lowestIndex = worstPool[Math.floor(Math.random() * worstPool.length)];
        /*for (let i = 0; i < this.fitnessScores.length; i++) {
            if (this.fitnessScores[i] < lowestFitness) {
                lowestFitness = this.fitnessScores[i];
                lowestIndex = i;
            }
        }*/
        return lowestIndex;
    }
    tournamentSelection() {
        // Implement selection logic (e.g., tournament selection, roulette wheel)
        // For simplicity, we'll just return two random genomes here
        const selectionSize = 3;
        let bestIndividual = null;
        let bestIndex = -1;
        for (i = 0; i < selectionSize; i++) {
            //Randomly select a genome from the population and compare fitness
            const randomIndex = Math.floor(Math.random() * this.genomes.length);
            if (bestIndividual === null || this.fitnessScores[randomIndex] > this.fitnessScores[bestIndex]) {
                bestIndividual = this.genomes[randomIndex];
                bestIndex = randomIndex;
            }
        }
        //const parentA = this.genomes[Math.floor(Math.random() * this.genomes.length)];
        //const parentB = this.genomes[Math.floor(Math.random() * this.genomes.length)];
        return {genome: bestIndividual, index: bestIndex, fitness: this.fitnessScores[bestIndex]};
    }
    evolveGeneration() {
        // Evaluate fitness of all genomes
        //const fitnessScores = this.genomes.map(genome => this.evaluateFitness(npc, targets, enemies));
        //SELECT PARENTS THROUGH TOURNAMENT SELECTION
        const parentA = this.tournamentSelection();
        const parentB = this.tournamentSelection();
        //CONDUCT CROSSOVER TO CREATE CHILD FROM CHOSEN PARENTS 
        const child = this.crossover(parentA.genome, parentB.genome);
        //MUTATE CHILD GENOME
        this.mutate(child);
        //Initialize remaining child genome properties
        child.metrics = null;
        child.fitness = 0;
        child.evaluations = 0;
        //REPLACE WORST GENOME IN CURRENT POPULATION: Worst chosen from bottom 20%
        const lowestIndex = this.findLowestFitnessIndex();
        this.genomes[lowestIndex] = child;
        // Reset fitness scores for the next evaluation (since population changed)
        //this.fitnessScores = new Array(this.genomes.length).fill(0);
    }
}
function roundTo(num, dec) {
  const factor = Math.pow(10, dec);
  return Math.round(num * factor) / factor;
}
function gaussianRandom(mean = 0, stdDev = 1) {
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.Pi * u2);
    return z0 * stdDev + mean;
}