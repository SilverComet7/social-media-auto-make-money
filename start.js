const { spawn } = require('child_process');
const path = require('path');

// 定义颜色输出函数
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m'
};

function log(color, prefix, message) {
  console.log(`${color}[${prefix}] ${message}${colors.reset}`);
}

// 启动服务函数
function startService(command, args, options, name) {
  const proc = spawn(command, args, {
    ...options,
    stdio: 'pipe', // 捕获输出
    shell: true
  });

  // 输出处理
  proc.stdout.on('data', (data) => {
    data.toString().split('\n').forEach(line => {
      if (line.trim()) log(colors.green, name, line);
    });
  });

  proc.stderr.on('data', (data) => {
    data.toString().split('\n').forEach(line => {
      if (line.trim()) log(colors.red, name, line);
    });
  });

  proc.on('error', (error) => {
    log(colors.red, name, `启动错误: ${error.message}`);
  });

  proc.on('close', (code) => {
    if (code !== null) {
      log(colors.yellow, name, `进程退出，退出码: ${code}`);
    }
  });

  return proc;
}

// 主函数
async function main() {
  try {
    // 定义服务配置
    const services = [
      {
        name: 'Backend',
        command: 'node',
        args: ['--inspect', 'index.js'],
        options: {
          cwd: path.join(__dirname, 'gameActivityBackEnd')
        }
      },
      {
        name: 'Frontend',
        command: 'npm',
        args: ['run', 'dev'],
        options: {
          cwd: path.join(__dirname, 'gameActivityFrontEnd')
        }
      },
      {
        name: 'Crawler',
        command: 'node',
        args: ['index.js'],
        options: {
          cwd: path.join(__dirname, 'crawler')
        }
      }
    ];

    // 启动所有服务
    const processes = services.map(service => {
      log(colors.blue, 'System', `正在启动 ${service.name}...`);
      return startService(service.command, service.args, service.options, service.name);
    });

    // 处理进程退出
    process.on('SIGINT', () => {
      log(colors.yellow, 'System', '正在关闭所有服务...');
      processes.forEach(proc => {
        proc.kill('SIGINT');
      });
      process.exit(0);
    });

    log(colors.blue, 'System', '所有服务已启动');
    log(colors.blue, 'System', '后端调试地址: chrome://inspect');

  } catch (error) {
    log(colors.red, 'System', `启动失败: ${error.message}`);
    process.exit(1);
  }
}

// 运行主函数
main().catch(error => {
  log(colors.red, 'System', `未处理的错误: ${error.message}`);
  process.exit(1);
}); 