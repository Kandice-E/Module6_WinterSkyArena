import * as THREE from 'three';
import { NPC } from './npc';
import { generationsCompleted } from './main';
import { mx_bilerp_0 } from 'three/src/nodes/materialx/lib/mx_noise.js';

export class Genome {
    constructor() {
        this.behavior = {
        jumpFrequency: roundTo(Math.random() * 2 + 4, 2), // 2 to 6 seconds (centered at ~5)
        ballThrowPower: roundTo(Math.random() * 50 + 40, 2), // 50 to 90 velocity multiplier (centered at ~70)
        ballThrowFrequency: roundTo(Math.random() * 0.75 + 2, 2), // 0.75 to 2.75 seconds (centered at ~4)
        targetSelectionRadius: roundTo(Math.random() * 10 + 40, 2), // 10 to 50 units (centered at ~40)
        enemyAvoidanceDistance: roundTo(Math.random() * 3 + 9, 2), // 3 to 12 units (centered at ~10)
        movementSpeedMultiplier: roundTo(Math.random() * 0.6 + 1.9, 2) // 0.6 to 2.5 multiplier (centered at ~1.5)
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
        //this.prevScore = 0;
    }
}
// Gene ranges for mutation (defined outside of class for easy access in mutation function)
const GENE_RANGES = {
    jumpFrequency: { min: 1.5, max: 7 }, // Keep original range for evolution flexibility
    ballThrowPower: { min: 50, max: 90 }, // Keep original range for evolution flexibility
    ballThrowFrequency: { min: 1.5, max: 5 }, // Keep original range for evolution flexibility
    targetSelectionRadius: { min: 5, max: 60 }, // Expanded for more exploration potential
    enemyAvoidanceDistance: { min: 2, max: 15 }, // Expanded range
    movementSpeedMultiplier: { min: 0.5, max: 2.75 } // Expanded for more variation
}
function createSeedGenome(type) {
    const g = new Genome();
    g.id = generateUniqueId();
    if (type === "aggressive") {
        g.behavior = {
            jumpFrequency: 4.5,
            ballThrowPower: 80,
            ballThrowFrequency: 2.2,
            targetSelectionRadius: 30,
            enemyAvoidanceDistance: 7,
            movementSpeedMultiplier: 2.4
        };
    }
    if (type === "defensive") {
        g.behavior = {
            jumpFrequency: 5.5,
            ballThrowPower: 65,
            ballThrowFrequency: 2.8,
            targetSelectionRadius: 45,
            enemyAvoidanceDistance: 11,
            movementSpeedMultiplier: 2.1
        };
    }
    if (type === "balanced") {
        g.behavior = {
            jumpFrequency: 5,
            ballThrowPower: 70,
            ballThrowFrequency: 2.5,
            targetSelectionRadius: 40,
            enemyAvoidanceDistance: 9,
            movementSpeedMultiplier: 2.2
        };
    }
    return g;
}
export class Population {
    constructor(size) {
        this.genomes = [];
        this.fitnessScores = [];
        this.previousScores = new Map();//<<<<<<<<<<<<<<<<<<<<<
        for (let i = 0; i < size; i++) {
            if (i < size * 0.5) {
            const types = ["aggressive", "defensive", "balanced"];
            const type = types[i % types.length];
            this.genomes.push(createSeedGenome(type));
        } else {
            this.genomes.push(new Genome());
        }
            this.genomes[i].id = generateUniqueId();
        }    
    }
    mutate(genome) {
        const baseMutationRate = 0.4; // Base 40% chance to mutate each gene
        const baseNoiseStdDev = 0.1; // Base noise at 10% of gene range
        const mutationRate = baseMutationRate + (1 - generationsCompleted / 50) * 0.25; // Increase mutation rate in early generations to encourage exploration, then gradually reduce to allow for convergence. At generation 0, mutationRate is 0.5 (50%), and it decreases to 0.25 (25%) by generation 50, then remains constant.
        const noiseStdDev = baseNoiseStdDev + (1 - generationsCompleted / 50) * 0.15;  // starts at 0.25 decays to 0.1

        Object.keys(GENE_RANGES).forEach(key => {
            if (Math.random() < mutationRate) {
                //console.log("Mutating genome...", {genomeId: genome.id, gene: key, oldValue: genome.behavior[key]});
                const {min, max} = GENE_RANGES[key];
                const range = max - min;
                const r = Math.random();
                if (r < 0.1) {
                    //Hard mutation: completely random new value (10% of mutations)
                    //console.log("Big mutation triggered for genome", genome.id, "gene", key);
                    genome.behavior[key] = min + Math.random() * range;
                } else if (r < 0.25) {
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
            competitive: 0.5, // Primary focus on outperforming player
            //closeness: 0.30, // Core Skill: Balancing score competitiveness without extreme risk
            adaptability: 0.25, // Secondary Reduced emphasis to allow for more diverse strategies that may not always outperform but show potential
            behavioral: 0.20, // Secondary
            responsiveness: 0.05 // Low Impact: Encourages quicker reactions and efficient play but allows for some latency in exchange for other strengths
        };
        //Start by identifying and storing each genome's metrics
        for (let g = 0; g < this.genomes.length; g++) {
            const genome = this.genomes[g];
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
            const npcScore = Math.max(0, npcStats.score);
            const playerScore = Math.max(0, playerStats.score);
            // FITNESS COMPONENT 1: [0, 1]
            const performanceGap = npcScore - playerScore;
            const targetGap = 2; // or small positive value if you want challenge
            const trackingScore = 1 - Math.min(1, Math.abs(performanceGap - targetGap) / 10);
            const competitiveRatio = npcScore / Math.max(1, playerScore);
            const normalizedRatio = Math.min(competitiveRatio, 1); // Normalize to [0, 1] with 1.5 as a reasonable upper bound for competitiveness
            const maxScore = Math.max(10, playerScore + npcScore); //Adds low performance sensitivity when scores are low
            const diffNormalized = (npcScore - playerScore) / maxScore; // [-1,1]
            const diffScore = (diffNormalized + 1) / 2; // [0,1]
            const baseRaw = 0.5 * normalizedRatio + 0.3 * diffScore;
            const base = Math.max(0, Math.min(1, baseRaw));
            const competitive = 0.6 * base + 0.4 * trackingScore;
            const epsilon = 0.02; // Stronger floor to avoid dead genomes
            avgComponents.competitive += epsilon + (1 - epsilon) * competitive; // Add small epsilon to prevent zero fitness and allow for some selection pressure even on less competitive genomes
            // FITNESS COMPONENT 2: [0, 1]
            let adaptability = 0;
            //console.log("previousScores exists:", this.previousScores);
            //console.log("genome.id:", genome.id);
            if (this.previousScores && this.previousScores.has(genome.id)) {
                const prevScore = this.previousScores.get(genome.id);
                const selfImprovement = (npcScore - prevScore) / Math.max(1, prevScore);
                const consistency = 1 - Math.abs(npcScore - prevScore) / Math.max(1, prevScore);
                const normImprovement = Math.max(0, Math.min(1, selfImprovement));
                adaptability = 0.7 * normImprovement + 0.3 * consistency;
            } else {
                // Fallback for first generation or new genomes
                adaptability = npcScore / Math.max(1, playerScore);
            }
            avgComponents.adaptability += adaptability;
            // FITNESS COMPONENT 3: [0, 1]
            const accuracy = (npcStats.targetsHit / Math.max(1, npcStats.ballsThrown));
            const avoidance = (npcStats.framesSafeDistance / Math.max(1, totalFrames)); // Take max to prevent division by zero
            const activity = npcStats.ballsThrown / Math.max(1, totalFrames); //Activity penelty (prevents camping)
            //avgComponents.behavioral += (0.4 * accuracy + 0.4 * avoidance + 0.2 * activity);
            let behavioralScore = (0.4 * Math.pow(accuracy, 1.5) + 0.4 * Math.pow(avoidance, 1.5) + 0.2 * Math.pow(activity, 1.2));
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
            // FITNESS COMPONENT 4: [0, 1]
            const latency = Math.min(Math.max(npcStats.avgActionLatency, 0.05), 0.3);
            const latencyScore = inverseRangeScore(latency, 0.05, 0.3);
            const jumpScore = rangeScore(npcStats.measuredJumpFrequency || 4, 3, 7);
            const turnScore = rangeScore(npcStats.turnSpeed || 5, 5, 10);
            const responsiveness = ((latencyScore || 0) + (jumpScore || 0) + (turnScore || 0)) / 3; // Average of the three subcomponents
            avgComponents.responsiveness += Math.pow(responsiveness, 1.5);
            //avgComponents.responsiveness += Math.min(1, responsiveness * 2);//WAS *2.5
            });
            const n = genomeMetrics.length;
            for (let key in avgComponents) { 
                avgComponents[key] /= n; // Average across rounds: Currently each genome is only tested once per generation, but this allows for future expansion to multiple tests per genome if desired for more robust fitness evaluation
            }
            //Recompute Weighted Total Fitness
            //Removing EMA since we are now evaluating fitness every round for each genome, so we want the most recent performance to be reflected in selection pressure without smoothing. This allows the population to adapt more quickly to changes and encourages exploration of new behaviors.
            let totalFitness = 0;
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
            // Store previous state for next round
            const lastMetric = genomeMetrics[genomeMetrics.length - 1];
            const currentScore = lastMetric?.npc?.score ?? 0;
            this.previousScores.set(genome.id, currentScore);
            //const lastMetric = genomeMetrics[genomeMetrics.length -1];//<<<<<<<<<<<
            //const currentScore = lastMetric?.npc?.score ?? 0;//<<<<<<<<<<<<<<<<<<
            //this.previousScores.set(genome.id, currentScore);//<<<<<<<<<<<<<<<<<<<<
        }
    }
    evolvePopulation() {
        const bestIndex = this.findBestGenomeIndex();
        const secondBestIndex = this.findSecondBestGenomeIndex(bestIndex);

        // 1. Identify the 2 worst genomes (excluding elites)
        const worstTwo = this.getIndicesOfWorstGenomes(bestIndex, secondBestIndex, 2);

        // 2. Identify 1 random mid-tier genome
        const midIndex = this.getMidTierIndex(bestIndex, secondBestIndex);

        // 3. Identify 1 slot for a brand-new genome
        const randomIndex = this.findLowestFitnessIndexExcludingBest(bestIndex);

        // --- REPLACEMENTS ---

        // Replace worst two with children of elites
        worstTwo.forEach(idx => {
            const child = this.crossover(
                this.genomes[bestIndex],
                this.genomes[secondBestIndex]
            );
            this.mutate(child);
            this.genomes[idx] = child;
        });

        // Replace mid-tier with a crossover child from tournament selection
        const parentA = this.tournamentSelection().genome;
        const parentB = this.tournamentSelection().genome;
        const midChild = this.crossover(parentA, parentB);
        this.mutate(midChild);
        this.genomes[midIndex] = midChild;

        // Replace one genome with a completely new seed genome
        const newSeed = this.createRandomSeed();
        this.genomes[randomIndex] = newSeed;
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
    getMidTierIndex(bestIndex, secondBestIndex) {
        const sorted = Array.from({length: this.genomes.length}, (_, i) => i)
            .filter(i => i !== bestIndex && i !== secondBestIndex)
            .sort((a, b) => this.genomes[b].fitness - this.genomes[a].fitness);

        // mid-tier = middle 40–60% of sorted list
        const start = Math.floor(sorted.length * 0.4);
        const end = Math.floor(sorted.length * 0.6);

        const midSlice = sorted.slice(start, end);
        return midSlice[Math.floor(Math.random() * midSlice.length)];
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
    createRandomSeed() {
        const types = ["aggressive", "defensive", "balanced"];
        const type = types[Math.floor(Math.random() * types.length)];
        const g = createSeedGenome(type);
        g.id = generateUniqueId();
        return g;
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
        //console.log("Replacing genome at index", lowestIndex, "with fitness", this.genomes[lowestIndex].fitness, "-> new child");
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