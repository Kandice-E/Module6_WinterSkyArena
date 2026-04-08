import * as THREE from 'three';
import { NPC } from './npc';

export class Genome {
    constructor() {
        this.behavior = {
        jumpFrequency: roundTo(Math.random() * 1.5 + 2.75, 2), // 2.75 to 4.25 seconds (centered at ~3.5)
        ballThrowPower: roundTo(Math.random() * 30 + 40, 2), // 40 to 70 velocity multiplier (centered at ~55)
        ballThrowFrequency: roundTo(Math.random() * 2 + 4, 2), // 4 to 6 seconds (centered at ~5)
        targetSelectionRadius: roundTo(Math.random() * 20 + 20, 2), // 20 to 40 units (centered at ~30)
        enemyAvoidanceDistance: roundTo(Math.random() * 4 + 8, 2), // 8 to 12 units (centered at ~10)
        movementSpeedMultiplier: roundTo(Math.random() * 0.6 + 1.2, 2) // 1.2 to 1.8 multiplier (centered at ~1.5)
        };
        this.fitness = 0;
        this.evaluations = 0;
        this.metrics = {
            competitive: 0,
            closeness: 0,
            adaptability: 0,
            behavioral: 0,
            responsiveness: 0
        };
        this.id = 0;
    }
}
const GENE_RANGES = {
            jumpFrequency: { min: 2, max: 5 }, // Keep original range for evolution flexibility
            ballThrowPower: { min: 30, max: 70 }, // Keep original range for evolution flexibility
            ballThrowFrequency: { min: 3, max: 7 }, // Keep original range for evolution flexibility
            targetSelectionRadius: { min: 10, max: 50 }, // Expanded for more exploration potential
            enemyAvoidanceDistance: { min: 5, max: 15 }, // Expanded range
            movementSpeedMultiplier: { min: 0.8, max: 2 } // Expanded for more variation
        }
export class Population {
    constructor(size) {
        this.genomes = [];
        for (let i = 0; i < size; i++) {
            this.genomes.push(new Genome());
            this.genomes[i].id = generateUniqueId();
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
                genome.behavior[key] += noise;
                //Clamp to range
                genome.behavior[key] = Math.max(min, Math.min(max, genome.behavior[key]));
            }
        });
    }
    crossover(parentA, parentB) {
        const child = new Genome();
        const alpha = 0.3;

        Object.keys(GENE_RANGES).forEach(key => {
            const p1 = parentA.behavior[key];
            const p2 = parentB.behavior[key];
            const minVal = Math.min(p1, p2);
            const maxVal = Math.max(p1, p2);
            const diff = maxVal - minVal;

            const rangeMin = minVal - alpha * diff;
            const rangeMax = maxVal + alpha * diff;

            child.behavior[key] = Math.random() * (rangeMax - rangeMin) + rangeMin;
            //Clamp to gene range
            const {min, max} = GENE_RANGES[key];
            child.behavior[key] = Math.max(min, Math.min(max, child.behavior[key]));
        });
        child.id = generateUniqueId();
        child.fitness = 0; // Initialize fitness for new children
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
        //Start by identifying and storing each genome's metrics
        for (let g = 0; g < this.genomes.length; g++) {
            const genomeMetrics = roundMetrics.filter(m => m.genomeIndex === g);
            //Skip if no metrics collected this round
            if (genomeMetrics.length === 0) continue;
            //Compute average terms across the rounds for this genome
            let avgComponents = {
                competitive: 0,
                closeness: 0,
                adaptability: 0,
                behavioral: 0,
                responsiveness:0
            };
            genomeMetrics.forEach(r => {
            const npcStats = r.npc;
            const playerStats = r.player;
            // Ensure no division by zero
            const npcTime = Math.max(npcStats.timeSurvived, 0.001);
            const playerTime = Math.max(playerStats.timeSurvived, 0.001);
            const totalFrames = Math.max(npcStats.totalFrames, 1);
            
            // FITNESS COMPONENT 1: [0, 1]
            const competitiveRatio = Math.min(npcStats.score / 
            Math.max(1, playerStats.score), 1.5);
            avgComponents.competitive += competitiveRatio / 1.5;
            // FITNESS COMPONENT 2: [0, 1]
            const scoreDiff = Math.abs(npcStats.score - playerStats.score);
            avgComponents.closeness += Math.max(0, (100 - scoreDiff * 2) / 100);
            // FITNESS COMPONENT 3: [0, 1]
            const scoreRatio = 0.5 * (npcStats.score / npcTime) + 0.5 * (npcStats.score / (npcStats.score + playerStats.score));
            const scoreRatioExpec = 0.5 * (playerStats.score / playerTime) + 0.5 * (playerStats.score / (playerStats.score + npcStats.score)); 
            avgComponents.adaptability += Math.max(0, (100 - Math.abs((scoreRatio * 100) - (scoreRatioExpec * 100))) / 100);
            // FITNESS COMPONENT 4: [0, 1]
            const accuracy =  (npcStats.targetsHit / Math.max(1, npcStats.ballsThrown));
            const avoidance = (npcStats.safeFrames / totalFrames);
            avgComponents.behavioral += (accuracy + avoidance) / 2;
            // FITNESS COMPONENT 5: [0, 1]
            const latencyScore = inverseRangeScore(npcStats.avgActionLatency || 0.1, 0.05, 0.3);
            const jumpScore = rangeScore(npcStats.measuredJumpFrequency || 4, 3, 7);
            const turnScore = rangeScore(npcStats.turnSpeed || 5, 5, 10);
            const responsiveness = (isNaN(latencyScore) ? 0 : latencyScore) + (isNaN(jumpScore) ? 0 : jumpScore) + (isNaN(turnScore) ? 0 : turnScore);
            avgComponents.responsiveness += responsiveness / 3;
            });
            //Divide by number of rounds to get average
            for (let key in avgComponents) {
                avgComponents[key] /= genomeMetrics.length;
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
                const componentValue = isNaN(genome.metrics[key]) ? 0 : genome.metrics[key];
                totalFitness += componentValue * weights[key];
            }
            //Store In Population Object For Reference
            genome.fitness = isNaN(totalFitness) ? 0 : totalFitness * 5;
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
        const k = Math.max(1, Math.floor(this.genomes.length * kPercent));
        let lowestIndex = 0;
        //let lowestFitness = this.fitnessScores[0];
        //Sort by fitness ascending worst to best
        const sortedFitness = Array.from({length: this.genomes.length}, (_, i) => i)
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
    findBestGenomeIndex() {
        let bestIndex = 0;
        let bestFitness = this.genomes[0].fitness;
        for (let i = 1; i < this.genomes.length; i++) {
            if (this.genomes[i].fitness > bestFitness) {
                bestFitness = this.genomes[i].fitness;
                bestIndex = i;
            }
        }
        return bestIndex;
    }
    findLowestFitnessIndexExcludingBest(bestIndex) {
        //Sort all genomes by fitness ascending (worst to best), excluding the best
        const sortedByFitness = Array.from({length: this.genomes.length}, (_, i) => i)
            .filter(i => i !== bestIndex)
            .sort((a, b) => this.genomes[a].fitness - this.genomes[b].fitness);
        // Return the single worst (first element)
        return sortedByFitness[0];
    }
    getIndicesOfWorstGenomes(bestIndex, count) {
        // Get indices of the N worst genomes, excluding the best
        const sortedByFitness = Array.from({length: this.genomes.length}, (_, i) => i)
            .filter(i => i !== bestIndex)
            .sort((a, b) => this.genomes[a].fitness - this.genomes[b].fitness);
        return sortedByFitness.slice(0, count);
    }
    tournamentSelection() {
        // Implement selection logic (e.g., tournament selection, roulette wheel)
        const selectionSize = 3;
        let bestIndividual = null;
        let bestIndex = -1;
        for (let i = 0; i < selectionSize; i++) {
            //Randomly select a genome from the population and compare fitness
            const randomIndex = Math.floor(Math.random() * this.genomes.length);
            if (bestIndividual === null || this.fitnessScores[randomIndex] > this.fitnessScores[bestIndex]) {
                bestIndividual = this.genomes[randomIndex];
                bestIndex = randomIndex;
            }
        }
        return {genome: bestIndividual, index: bestIndex, fitness: this.fitnessScores[bestIndex]};
    }
    evolveGenerationWithElitism(bestIndex) {
        //SELECT PARENTS THROUGH TOURNAMENT SELECTION
        const parentA = this.tournamentSelection();
        const parentB = this.tournamentSelection();
        //CONDUCT CROSSOVER TO CREATE CHILD FROM CHOSEN PARENTS 
        const child = this.crossover(parentA.genome, parentB.genome);
        //MUTATE CHILD GENOME
        this.mutate(child);
        //Initialize remaining child genome properties
        child.id = generateUniqueId();
        child.metrics = null;
        child.fitness = 0;
        child.evaluations = 0;
        //REPLACE WORST GENOME IN CURRENT POPULATION (excluding best): Find single worst
        const lowestIndex = this.findLowestFitnessIndexExcludingBest(bestIndex);
        console.log("Replacing genome at index", lowestIndex, "with fitness", this.genomes[lowestIndex].fitness, "-> new child");
        const parentFitness = this.genomes[lowestIndex].fitness; // Inherit fitness from replaced genome
        this.genomes[lowestIndex] = child;
        // UPDATE fitnessScores array to keep in sync with population
        // Use parent's fitness to avoid child being selected as "worst" on next iteration
        this.fitnessScores[lowestIndex] = parentFitness;
    }
}
function roundTo(num, dec) {
  const factor = Math.pow(10, dec);
  return Math.round(num * factor) / factor;
}
function gaussianRandom(mean = 0, stdDev = 1) {
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    return z0 * stdDev + mean;
}
function generateUniqueId() {
    return Math.random().toString(36).substring(2, 10);
}
function rangeScore(value, min, max) {
    if (value < min) return value / min;
    if (value > max) return Math.max(0, 1 - (value - max) / min);
    return 1;
}
function inverseRangeScore(value, min, max) {
    if (value < min) return 1; //ideal or better
    if (value > max) return Math.max(0, 1 - (value - max) / min);
    return 1;
}