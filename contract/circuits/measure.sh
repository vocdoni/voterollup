nvm use 16
node --trace-gc --trace-gc-ignore-scavenger --max-old-space-size=2048000 --initial-old-space-size=2048000 --no-global-gc-scheduling --no-incremental-marking --max-semi-space-size=1024 --initial-heap-size=2048000 ../node_modules/circom/cli.js rollup.circom -r -v
snarkjs r1cs info rollup.r1cs
