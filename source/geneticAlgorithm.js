import * as THREE from 'three';
import { NPC } from './npc';
import { generationsCompleted } from './main';
import { mx_bilerp_0 } from 'three/src/nodes/materialx/lib/mx_noise.js';

export class Genome {
    constructor() {
        this.behavior = {
        jumpFrequency: roundTo(Math.random() * 2 + 4, 2), // 2 to 6 seconds (centered at ~5)
        ballThrowPower: roundTo(Math.random() * 50 + 40, 2), // 50 to 90 velocity multiplier (centered at ~70)
        ballThrowFrequency: roundTo(Math.random() * 2 + 3, 2), // 2 to 5 seconds (centered at ~4)
        targetSelectionRadius: roundTo(Math.random() * 30 + 20, 2), // 30 to 50 units (centered at ~40)
        enemyAvoidanceDistance: roundTo(Math.random() * 4 + 8, 2), // 8 to 12 units (centered at ~10)
        movementSpeedMultiplier: roundTo(Math.random() * 0.6 + 1.2, 2) // 1.2 to 1.8 multiplier (centered at ~1.5)
        };
        this.fitness = 0;
        this.evaluations = 0;
        this.metrics = {
            competitive: 0,
            //closeness: 0,
            adaptability: 0,
            behavioral: 0,
            responsiveness: 0
        };
        this.id = 0;
    }
}
// Gene ranges for mutation (defined outside of class for easy access in mutation function)
const GENE_RANGES = {
    jumpFrequency: { min: 1.5, max: 7 }, // Keep original range for evolution flexibility
    ballThrowPower: { min: 50, max: 90 }, // Keep original range for evolution flexibility
    ballThrowFrequency: { min: 2, max: 5 }, // Keep original range for evolution flexibility
    targetSelectionRadius: { min: 10, max: 60 }, // Expanded for more exploration potential
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
        const baseMutationRate = 0.4; // Base 40% chance to mutate each gene
        const baseNoiseStdDev = 0.25; // Base noise at 10% of gene range
        const mutationRate = baseMutationRate + (1 - generationsCompleted / 50) * 0.25; // Increase mutation rate in early generations to encourage exploration, then gradually reduce to allow for convergence. At generation 0, mutationRate is 0.5 (50%), and it decreases to 0.25 (25%) by generation 50, then remains constant.
        const noiseStdDev = baseNoiseStdDev + (1 - generationsCompleted / 50) * 0.15;  // starts at 0.25 decays to 0.1

        Object.keys(GENE_RANGES).forEach(key => {
            if (Math.random() < mutationRate) {
                console.log("Mutating genome...", {genomeId: genome.id, gene: key, oldValue: genome.behavior[key]});
                const {min, max} = GENE_RANGES[key];
                const range = max - min;
                const r = Math.random();
                if (r < 0.1) {
                    //Hard mutation: completely random new value (10% of mutations)
                    console.log("Big mutation triggered for genome", genome.id, "gene", key);
                    genome.behavior[key] = min + Math.random() * range;
                } else if (r < 0.4) {
                    //Large mutation: 30%
                    genome.behavior[key] += gaussianRandom(0, 0.5 * range);
                } else {
                    //Small mutation: 60%
                    genome.behavior[key] += gaussianRandom(0, noiseStdDev * range);
                }
                //Clamp to range
                genome.behavior[key] = Math.max(min, Math.min(max, genome.behavior[key]));
            }
        });
    }
    crossover(parentA, parentB) {
        const child = new Genome();
        const alpha = 0.3;

        Object.keys(GENE_RANGES).forEach(key => {
            if (Math.random() < 0.2) {
                // 20% chance: completely random gene (diversity injection)
                const { min, max } = GENE_RANGES[key];
                child.behavior[key] = min + Math.random() * (max - min);
            } else {
                // BLX-alpha crossover
                const p1 = parentA.behavior[key];
                const p2 = parentB.behavior[key];

                const minVal = Math.min(p1, p2);
                const maxVal = Math.max(p1, p2);
                const diff = maxVal - minVal;

                //const alpha = 0.5; // increase from 0.3
                const rangeMin = minVal - alpha * diff;
                const rangeMax = maxVal + alpha * diff;

                child.behavior[key] = Math.random() * (rangeMax - rangeMin) + rangeMin;
            }
        });
        child.id = generateUniqueId();
        child.fitness = 0; // Initialize fitness for new children
        return child;
    } //-----START HERE WITH UPDATES-----//
    //-----Refactor fitness evaluation to be done on each genome in the population-----//
    evaluateFitness(roundMetrics) {
        const weights = {
            competitive: 0.45, // Primary focus on outperforming player
            //closeness: 0.30, // Core Skill: Balancing score competitiveness without extreme risk
            adaptability: 0.25, // Secondary Reduced emphasis to allow for more diverse strategies that may not always outperform but show potential
            behavioral: 0.20, // Secondary
            responsiveness: 0.10 // Low Impact: Encourages quicker reactions and efficient play but allows for some latency in exchange for other strengths
        };
        //Start by identifying and storing each genome's metrics
        for (let g = 0; g < this.genomes.length; g++) {
            const genomeMetrics = roundMetrics.filter(m => m.genomeIndex === g);
            //Skip if no metrics collected this round
            if (genomeMetrics.length === 0) continue;
            //Compute average terms across the rounds for this genome
            let avgComponents = {
                competitive: 0,
                //closeness: 0,
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
            const npcScore = Math.max(0, npcStats.score);
            const playerScore = Math.max(0, playerStats.score);

            const winBonus = npcScore > playerScore ? 1 : 0; // Add a win bonus to strongly reward outperforming the player
            const competitiveRatio = npcScore / Math.max(1, playerScore);
            const normalizedRatio = Math.min(competitiveRatio, 1); // Normalize to [0, 1] with 1.5 as a reasonable upper bound for competitiveness
            const maxScore = Math.max(10, playerScore + npcScore); //Adds low performance sensitivity when scores are low
            const diffNormalized = (npcScore - playerScore) / maxScore; // [-1,1]
            const diffScore = (diffNormalized + 1) / 2; // [0,1]
            const baseRaw = 0.5 * normalizedRatio + 0.3 * diffScore + 0.2 * winBonus;
            const base = Math.max(0, Math.min(1, baseRaw));
            const competitive = Math.pow(base, 1.5); // amplify differences with exponentiation to increase selection pressure for more competitive genomes, while still allowing some credit for close performance to encourage incremental improvements. The 1.5 exponent provides a good balance between rewarding competitiveness and maintaining diversity in a small population.
            const epsilon = 0.02; // Stronger floor to avoid dead genomes
            avgComponents.competitive += epsilon + (1 - epsilon) * competitive; // Add small epsilon to prevent zero fitness and allow for some selection pressure even on less competitive genomes
            // FITNESS COMPONENT 2: [0, 1]
            //const scoreDiff = Math.abs(npcStats.score - playerStats.score);
            //if (npcStats.score < playerStats.score) { // Only reward closeness when losing
            //    avgComponents.closeness += Math.max(0, (100 - scoreDiff * 2) / 100);
            //}
            // FITNESS COMPONENT 3: [0, 1]
            const scoreRatio = 0.5 * (npcScore / npcTime) + 0.5 * (npcScore / Math.max(1, npcScore + playerScore));
            const scoreRatioExpec = 0.5 * (playerScore / playerTime) + 0.5 * (playerScore / Math.max(1, playerScore + npcScore)); 
            const diff = Math.abs(scoreRatio - scoreRatioExpec);
            //const adaptability = Math.exp(-5 * diff); // Exponential penalty (sharper, harder to exploit)
            //avgComponents.adaptability += Math.min(1, adaptability);
            const adaptabilityRaw = 1 - Math.abs(scoreRatio - scoreRatioExpec);
            avgComponents.adaptability += Math.max(0, Math.min(1, adaptabilityRaw));
            // FITNESS COMPONENT 4: [0, 1]
            const accuracy = (npcStats.targetsHit / Math.max(1, npcStats.ballsThrown));
            const avoidance = (npcStats.framesSafeDistance / Math.max(1, totalFrames)); // Take max to prevent division by zero
            const activity = npcStats.ballsThrown / Math.max(1, totalFrames); //Activity penelty (prevents camping)
            //avgComponents.behavioral += (0.4 * accuracy + 0.4 * avoidance + 0.2 * activity);
            let behavioralScore = (0.4 * accuracy + 0.4 * avoidance + 0.2 * activity);
            // Penalize degenerate strategies
            const behavior = this.genomes[g].behavior;
            // Too small targeting radius → overly exploitative
            if (behavior.targetSelectionRadius < 15) {
                behavioralScore *= 0.8;
            }
            // Too little avoidance → reckless / unrealistic
            if (behavior.enemyAvoidanceDistance < 6) {
                behavioralScore *= 0.85;
            }
            avgComponents.behavioral += Math.min(0.3, behavioralScore);
            // FITNESS COMPONENT 5: [0, 1]
            const latencyScore = inverseRangeScore(npcStats.avgActionLatency || 0.1, 0.05, 0.3);
            const jumpScore = rangeScore(npcStats.measuredJumpFrequency || 4, 3, 7);
            const turnScore = rangeScore(npcStats.turnSpeed || 5, 5, 10);
            const responsiveness = ((latencyScore || 0) + (jumpScore || 0) + (turnScore || 0)) / 3; // Average of the three subcomponents
            //avgComponents.responsiveness += Math.pow(Math.min(1, responsiveness), 1.2);
            avgComponents.responsiveness += Math.min(1, responsiveness * 2.5);
            });
            const n = genomeMetrics.length;
            for (let key in avgComponents) {
                avgComponents[key] /= n; // Average across rounds: Currently each genome is only tested once per generation, but this allows for future expansion to multiple tests per genome if desired for more robust fitness evaluation
            }
            //Recompute Weighted Total Fitness
            //Removing EMA since we are now evaluating fitness every round for each genome, so we want the most recent performance to be reflected in selection pressure without smoothing. This allows the population to adapt more quickly to changes and encourages exploration of new behaviors.
            let totalFitness = 0;
            const genome = this.genomes[g];
            for (let key in avgComponents) {
                genome.metrics[key] = avgComponents[key]; // Store the average component values in the genome's metrics for reference
                genome.evaluations++; // Increment evaluations for this genome
            }
            for (let key in genome.metrics) {
                const componentValue = isNaN(genome.metrics[key]) ? 0 : genome.metrics[key];
                totalFitness += componentValue * weights[key];
            }
            //Store In Population Object For Reference
            genome.fitness = isNaN(totalFitness) ? 0 : totalFitness; // Final fitness is noramlized to [0, 1]
            this.fitnessScores[g] = genome.fitness;
            //this.fitnessScores[g] = genomeMetrics.length > 0 ? fitness * 5 : 0;
        }
    }
    findLowestFitnessIndex() {
        const kPercent = 0.2;
        const k = Math.max(1, Math.floor(this.genomes.length * kPercent));
        let lowestIndex = 0;
        //Sort by fitness ascending worst to best
        const sortedFitness = Array.from({length: this.genomes.length}, (_, i) => i)
        .sort((a,b) => this.genomes[a].fitness - this.genomes[b].fitness);
        //Take indices of worst k%
        const worstPool = sortedFitness.slice(0, k);
        //Pick a random index from the worst pool
        lowestIndex = worstPool[Math.floor(Math.random() * worstPool.length)];
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
    findSecondBestGenomeIndex(bestIndex) {
        let secondBestIndex = 0;
        let secondBestFitness = this.genomes[0].fitness;
        for (let i = 1; i < this.genomes.length; i++) {
            if (i === bestIndex) continue;
            if (this.genomes[i].fitness > secondBestFitness) {
                secondBestFitness = this.genomes[i].fitness;
                secondBestIndex = i;
            }
        }
        return secondBestIndex;
    }
    findLowestFitnessIndexExcludingBest(bestIndex) {
        //Sort all genomes by fitness ascending (worst to best), excluding the best
        const sortedByFitness = Array.from({length: this.genomes.length}, (_, i) => i)
            .filter(i => i !== bestIndex)
            .sort((a, b) => this.genomes[a].fitness - this.genomes[b].fitness);
        // Return the single worst (first element)
        return sortedByFitness[0];
    }
    getIndicesOfWorstGenomes(bestIndex, secondBestIndex, count) {
        // Get indices of the N worst genomes, excluding the best and second best
        const sortedByFitness = Array.from({length: this.genomes.length}, (_, i) => i)
            .filter(i => i !== bestIndex && i !== secondBestIndex)
            .sort((a, b) => this.genomes[a].fitness - this.genomes[b].fitness);
        return sortedByFitness.slice(0, count);
    }
    tournamentSelection() {
        // Implement selection logic (e.g., tournament selection, roulette wheel)
        const selectionSize = 4;
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
export function generateUniqueId() {
    return Math.random().toString(36).substring(2, 10);
}
export function genomesTooSimilar(a, b) {
    let diff = 0;
    Object.keys(GENE_RANGES).forEach(key => {
        diff += Math.abs(a.behavior[key] - b.behavior[key]);
    });
    return diff < 0.1; // tune threshold
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