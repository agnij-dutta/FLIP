#!/bin/bash
# Install Foundry for testing

echo "🔧 Installing Foundry..."

# Check if already installed
if command -v forge &> /dev/null; then
    echo "✅ Foundry already installed:"
    forge --version
    exit 0
fi

# Install Foundry
echo "📥 Downloading Foundry installer..."
curl -L https://foundry.paradigm.xyz | bash

# Source shell config
if [ -f ~/.bashrc ]; then
    source ~/.bashrc
elif [ -f ~/.zshrc ]; then
    source ~/.zshrc
fi

# Install foundryup
if ! command -v foundryup &> /dev/null; then
    export PATH="$HOME/.foundry/bin:$PATH"
fi

# Run foundryup
foundryup

echo "✅ Foundry installed!"
forge --version
