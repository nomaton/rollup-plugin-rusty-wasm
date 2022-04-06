use wasm_bindgen::prelude::*;

#[global_allocator]
static GLOBAL_ALLOC: wee_alloc::WeeAlloc = wee_alloc::WeeAlloc::INIT;

#[wasm_bindgen]
#[repr(u8)]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Cell {
    Dead = 0,
    Alive = 1,
}

#[wasm_bindgen]
pub struct Universe {
    width: u32,
    height: u32,
    cells: Vec<Cell>,
}

#[wasm_bindgen]
impl Universe {
    pub fn new() -> Universe {
        let width = 23u32;
        let height = 23u32;
        let mut cells = vec![Cell::Dead; (width * height) as usize];
        // galaxy
        for x in 0..6 {
            cells[(4 * width + 7 + x) as usize] = Cell::Alive;
            cells[(5 * width + 7 + x) as usize] = Cell::Alive;
            cells[((4 + x) * width + 14) as usize] = Cell::Alive;
            cells[((4 + x) * width + 15) as usize] = Cell::Alive;
            cells[(11 * width + 15 - x) as usize] = Cell::Alive;
            cells[(12 * width + 15 - x) as usize] = Cell::Alive;
            cells[((12 - x) * width + 7) as usize] = Cell::Alive;
            cells[((12 - x) * width + 8) as usize] = Cell::Alive;
        }
        // spaceship
        cells[(17 * width + 3) as usize] = Cell::Alive;
        cells[(17 * width + 6) as usize] = Cell::Alive;
        cells[(18 * width + 2) as usize] = Cell::Alive;
        cells[(19 * width + 2) as usize] = Cell::Alive;
        cells[(19 * width + 6) as usize] = Cell::Alive;
        cells[(20 * width + 2) as usize] = Cell::Alive;
        cells[(20 * width + 3) as usize] = Cell::Alive;
        cells[(20 * width + 4) as usize] = Cell::Alive;
        cells[(20 * width + 5) as usize] = Cell::Alive;

        Universe {
            width,
            height,
            cells,
        }
    }

    pub fn width(&self) -> u32 {
        self.width
    }

    pub fn height(&self) -> u32 {
        self.height
    }

    pub fn cells(&self) -> *const Cell {
        self.cells.as_ptr()
    }

    pub fn tick(&mut self) {
        let mut next = self.cells.clone();

        for row in 0..self.height {
            for col in 0..self.width {
                let idx = self.get_index(row, col);
                let cell = self.cells[idx];
                let live_neighbors = self.live_neighbor_count(row, col);

                let next_cell = match (cell, live_neighbors) {
                    // Rule 1: Any live cell with fewer than two live neighbours
                    // dies, as if caused by underpopulation.
                    (Cell::Alive, x) if x < 2 => Cell::Dead,
                    // Rule 2: Any live cell with two or three live neighbours
                    // lives on to the next generation.
                    (Cell::Alive, 2) | (Cell::Alive, 3) => Cell::Alive,
                    // Rule 3: Any live cell with more than three live
                    // neighbours dies, as if by overpopulation.
                    (Cell::Alive, x) if x > 3 => Cell::Dead,
                    // Rule 4: Any dead cell with exactly three live neighbours
                    // becomes a live cell, as if by reproduction.
                    (Cell::Dead, 3) => Cell::Alive,
                    // All other cells remain in the same state.
                    (otherwise, _) => otherwise,
                };

                next[idx] = next_cell;
            }
        }

        self.cells = next;
    }

    fn get_index(&self, row: u32, column: u32) -> usize {
        (row * self.width + column) as usize
    }

    fn live_neighbor_count(&self, row: u32, column: u32) -> u8 {
        let mut count = 0;
        for delta_row in [self.height - 1, 0, 1].iter().cloned() {
            for delta_col in [self.width - 1, 0, 1].iter().cloned() {
                if delta_row == 0 && delta_col == 0 {
                    continue;
                }

                let neighbor_row = (row + delta_row) % self.height;
                let neighbor_col = (column + delta_col) % self.width;
                let idx = self.get_index(neighbor_row, neighbor_col);
                count += self.cells[idx] as u8;
            }
        }
        count
    }
}
