def is_hamiltonian(graph):
    n = len(graph)
    path = [-1] * n

    # Start at vertex 0
    path[0] = 0

    def is_safe(v, pos):
        # Check if this vertex is adjacent to the previous vertex in the path
        if not graph[path[pos - 1]][v]:
            return False

        # Check if the vertex has already been included in the path
        if v in path:
            return False

        return True

    def hamiltonian_cycle_util(pos):
        if pos == n:
            # Check if there's an edge from the last vertex to the first
            return graph[path[pos - 1]][path[0]] == 1

        for v in range(1, n):
            if is_safe(v, pos):
                path[pos] = v
                if hamiltonian_cycle_util(pos + 1):
                    return True
                path[pos] = -1  # Backtrack

        return False

    if hamiltonian_cycle_util(1):
        return path + [path[0]]  # Return the cycle including return to start
    else:
        return None
graph = [
    [0, 1, 0, 1],
    [1, 0, 1, 0],
    [1, 0, 0, 1],
    [1, 0, 0, 0]
]

cycle = is_hamiltonian(graph)
if cycle:
    print("Hamiltonian Cycle:", cycle)
else:
    print("No Hamiltonian Cycle found.")
