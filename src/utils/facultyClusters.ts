import { humanitiesFaculties } from './facultyContent';

/**
 * Faculty Clustering Configuration
 *
 * This module defines the faculty cluster for reviewer assignment.
 * Reviewers must be from a different faculty than the submitter,
 * but within the same cluster.
 *
 * Key Rules:
 * 1. A reviewer cannot review a manuscript from their own faculty
 * 2. A reviewer must be from a faculty in the same cluster
 * 3. Admin can review manuscripts from any faculty regardless of cluster
 */

/**
 * Returns the raw faculty and department data for UI purposes.
 */
export const getFacultyDepartmentData = () => {
  return humanitiesFaculties;
};

// Define cluster mappings
export interface ClusterMap {
  [faculty: string]: string[];
}

/**
 * Humanities Cluster
 * Dynamically generated from the keys of humanitiesFaculties.
 * This creates a fully connected cluster where any faculty can review for any other,
 * but not for themselves.
 */
const facultyNames = Object.keys(humanitiesFaculties);
export const humanitiesCluster: ClusterMap = facultyNames.reduce(
  (cluster, faculty) => {
    cluster[faculty] = facultyNames.filter((f) => f !== faculty);
    return cluster;
  },
  {} as ClusterMap
);

/**
 * Get eligible faculties for reviewer assignment.
 * Assumes the input is a canonical faculty name from the cluster.
 * @param submitterFaculty - The canonical faculty name of the manuscript submitter.
 * @returns Array of faculty names that can review this manuscript.
 */
export function getEligibleFaculties(submitterFaculty: string): string[] {
  return humanitiesCluster[submitterFaculty] || [];
}

/**
 * Check if two faculties are in the same cluster.
 * Assumes inputs are canonical faculty names.
 * @param faculty1 - First faculty name.
 * @param faculty2 - Second faculty name.
 * @returns True if faculties are in the same cluster.
 */
export function areInSameCluster(faculty1: string, faculty2: string): boolean {
  const eligibleForFaculty1 = humanitiesCluster[faculty1] || [];
  return eligibleForFaculty1.includes(faculty2) || faculty1 === faculty2;
}

/**
 * Check if a reviewer from a given faculty can review a manuscript.
 * This is the core logic for reviewer assignment based on faculty.
 * Assumes inputs are canonical faculty names from the 'assignedFaculty' field.
 * @param reviewerFaculty - Reviewer's assigned faculty.
 * @param submitterFaculty - Submitter's assigned faculty.
 * @returns True if reviewer is eligible.
 */
export function canReview(
  reviewerFaculty: string,
  submitterFaculty: string
): boolean {
  // A user must have an assigned faculty to participate in review logic.
  if (!reviewerFaculty || !submitterFaculty) {
    return false;
  }

  // Rule 1: Reviewer cannot review manuscripts from their own faculty.
  if (reviewerFaculty === submitterFaculty) {
    return false;
  }

  // Rule 2: A reviewer must be from a faculty in the same cluster.
  const eligibleFaculties = getEligibleFaculties(submitterFaculty);

  // Check if reviewer's faculty is in the eligible list.
  return eligibleFaculties.includes(reviewerFaculty);
}

/**
 * Get all faculties in the cluster.
 * @returns Array of all faculty names in the cluster.
 */
export function getAllFacultiesInCluster(): string[] {
  return Object.keys(humanitiesCluster);
}

/**
 * Validate if a faculty exists in the cluster.
 * @param faculty - Faculty name to validate.
 * @returns True if faculty exists in the cluster.
 */
export function isFacultyInCluster(faculty: string): boolean {
  return !!humanitiesCluster[faculty];
}

/**
 * Get cluster statistics for the admin dashboard.
 * @returns Statistics about the cluster.
 */
export function getClusterStatistics(): {
  totalFaculties: number;
  averageConnections: number;
  faculties: string[];
  } {
  const faculties = Object.keys(humanitiesCluster);
  const totalFaculties = faculties.length;

  if (totalFaculties === 0) {
    return { totalFaculties: 0, averageConnections: 0, faculties: [] };
  }

  const totalConnections = Object.values(humanitiesCluster).reduce(
    (sum, connections) => sum + connections.length,
    0
  );

  const averageConnections = totalConnections / totalFaculties;

  return {
    totalFaculties,
    averageConnections: Math.round(averageConnections * 10) / 10,
    faculties,
  };
}

// Example usage:
/*
import { canReview } from './utils/facultyClusters';

// Check if a reviewer can review a manuscript
const isEligible = canReview(
  'Faculty of Law',   // Reviewer's assigned faculty
  'Faculty of Arts'   // Submitter's assigned faculty
);
// Returns: true

const notEligibleSameFaculty = canReview(
  'Faculty of Arts',  // Reviewer's assigned faculty
  'Faculty of Arts'   // Submitter's assigned faculty
);
// Returns: false
*/
