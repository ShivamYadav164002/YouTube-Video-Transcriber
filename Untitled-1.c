#include <stdio.h>
#include <stdbool.h>

#define N 4  // Change this value to solve for different board sizes

int board[N][N];

// Function to print the solution
void printSolution() {
    for (int i = 0; i < N; i++) {
        for (int j = 0; j < N; j++) {
            printf("%c ", board[i][j] ? 'Q' : '.');
        }
        printf("\n");
    }
    printf("\n");
}

// Check if it's safe to place a queen at board[row][col]
bool isSafe(int row, int col) {
    // Check column
    for (int i = 0; i < row; i++)
        if (board[i][col])
            return false;

    // Check upper left diagonal
    for (int i = row - 1, j = col - 1; i >= 0 && j >= 0; i--, j--)
        if (board[i][j])
            return false;

    // Check upper right diagonal
    for (int i = row - 1, j = col + 1; i >= 0 && j < N; i--, j++)
        if (board[i][j])
            return false;

    return true;
}

// Recursive function to solve the N-Queen problem
bool solveNQueen(int row) {
    if (row == N) {
        printSolution();  // One solution found
        return true;      // Change to 'false' if you want to print all solutions
    }

    bool res = false;
    for (int col = 0; col < N; col++) {
        if (isSafe(row, col)) {
            board[row][col] = 1;          // Place queen
            res = solveNQueen(row + 1) || res;  // Move to next row
            board[row][col] = 0;          // Backtrack
        }
    }
    return res;
}

int main() {
    if (!solveNQueen(0))
        printf("No solution exists\n");
    return 0;
}
