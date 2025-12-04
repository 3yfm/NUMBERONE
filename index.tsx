import React, { useEffect, useRef } from 'react';
import p5 from 'p5';
import GUI from 'lil-gui';

export default function CyberpunkBoxRoll() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const sketch = (p: p5) => {
      // 蓝粉/赛博朋克配色方案
      const palette = [
        "#f72585", // 0: 霓虹粉 (Hot)
        "#7209b7", // 1: 紫色 (Hot)
        "#3a0ca3", // 2: 深蓝 (Cool)
        "#4361ee", // 3: 亮蓝 (Cool)
        "#4cc9f0", // 4: 青色 (Cool)
        "#b5179e", // 5: 深粉 (Hot)
        "#00f5d4"  // 6: 亮青绿 (Cool)
      ];

      // Helper to categorize colors
      const hotColors = [palette[0], palette[1], palette[5]];
      const coolColors = [palette[2], palette[3], palette[4], palette[6]];

      let side: number;
      let directions: { desc: string; dir: p5.Vector; pivotPt: p5.Vector }[];
      let rows = 20;
      let cols = 20;
      let boxes: RollBox[] = [];
      let cam: p5.Camera;
      let gui: GUI;
      let params: {
        lightsOn: boolean;
        rotateMode: boolean;
        globalRotationFrames: number;
        threshold: number;
        autoMarch: boolean;
      };

      // 摄像头交互变量
      let video: p5.MediaElement;
      let prevPixels: number[] = [];
      let motionThreshold = 20;

      class RollBox {
        p: p5;
        originalP: p5.Vector;
        pos: p5.Vector;
        animating: boolean;
        startFrame: number;
        totalFrames: number;
        a: number;
        dir: { desc: string; dir: p5.Vector; pivotPt: p5.Vector };
        col: p5.Color;
        sideLength: number;
        edgeOffset: number;

        constructor(p: p5, x: number, y: number, z: number, sideLength: number) {
          this.p = p;
          this.originalP = p.createVector(x, y, z);
          this.pos = p.createVector(x, y, z);
          this.animating = false;
          this.startFrame = 0;
          this.totalFrames = 10; // 默认速度
          this.a = 0;
          this.dir = p.random(directions);
          this.col = p.color(p.random(coolColors)); // 默认为冷色
          this.col.setAlpha(180);
          this.sideLength = sideLength * 0.9;
          this.edgeOffset = p.sqrt(2) * this.sideLength * 0.5;
        }

        // 接收速度和强度参数
        startAnimation(customDir: { desc: string; dir: p5.Vector; pivotPt: p5.Vector } | null = null, frames = 20, intensity = 0) {
          if (!this.animating) {
            let dir = !customDir ? this.p.random(directions) : customDir;
            this.dir = {
              desc: dir.desc,
              dir: dir.dir.copy(),
              pivotPt: dir.pivotPt.copy()
            };

            this.animating = true;
            this.startFrame = this.p.frameCount;
            this.totalFrames = frames;

            // 根据强度改变颜色
            // 剧烈运动 -> 暖色/粉紫色，且不透明度高
            // 轻微运动 -> 冷色/蓝青色，且较透明
            if (intensity > 0.4) {
              this.col = this.p.color(this.p.random(hotColors));
              this.col.setAlpha(255); // 剧烈时更亮更实
            } else {
              this.col = this.p.color(this.p.random(coolColors));
              this.col.setAlpha(120 + intensity * 135); // 轻微时半透明
            }
          }
        }

        update() {
          if (this.animating) {
            // 使用动态的 totalFrames 来计算进度
            this.a = this.p.HALF_PI * (this.p.frameCount - this.startFrame) / this.totalFrames;

            if (this.a > this.p.HALF_PI) {
              this.a = 0;
              this.pos.add(this.dir.dir.mult(this.edgeOffset * 2));
              this.animating = false;

              // 边界检查
              let dist = this.pos.dist(this.originalP);
              if (dist > this.p.width * 0.8) {
                this.pos = this.originalP.copy();
              }
            }
          }
        }

        show() {
          this.p.push();
          this.p.translate(this.pos.x, this.pos.y, this.pos.z);

          this.p.translate(
            this.dir.pivotPt.x * this.edgeOffset,
            this.dir.pivotPt.y * this.edgeOffset,
            this.dir.pivotPt.z * this.edgeOffset
          );

          if (this.animating) {
            switch (this.dir.desc) {
              case "FORWARD": this.p.rotateX(-this.a); break;
              case "BACKWARD": this.p.rotateX(this.a); break;
              case "RIGHT": this.p.rotateZ(this.a); break;
              case "LEFT": this.p.rotateZ(-this.a); break;
            }
          }

          this.p.translate(
            -this.dir.pivotPt.x * this.edgeOffset,
            -this.dir.pivotPt.y * this.edgeOffset,
            -this.dir.pivotPt.z * this.edgeOffset
          );

          this.p.noStroke();
          this.p.fill(this.col);
          this.p.box(this.sideLength);

          // 线框颜色稍微亮一点
          this.p.strokeWeight(2);
          let strokeCol = this.p.color(255);
          strokeCol.setAlpha(100);
          this.p.stroke(strokeCol);
          this.p.noFill();
          this.p.box(this.sideLength);

          this.p.pop();
        }
      }

      p.setup = () => {
        p.createCanvas(p.min(p.windowWidth, p.windowHeight), p.min(p.windowWidth, p.windowHeight), p.WEBGL);
        p.pixelDensity(1);

        // 初始化 GUI
        gui = new GUI();
        params = {
          lightsOn: true,
          rotateMode: false,
          globalRotationFrames: 1200,
          threshold: 20,
          autoMarch: false
        };
        gui.add(params, 'lightsOn');
        gui.add(params, 'rotateMode');
        gui.add(params, 'globalRotationFrames', 30, 2400, 30);
        gui.add(params, 'threshold', 5, 100).onChange((v: number) => motionThreshold = v);
        gui.add(params, 'autoMarch');
        
        // Ensure GUI is cleaned up
        gui.domElement.style.position = 'absolute';
        gui.domElement.style.top = '10px';
        gui.domElement.style.right = '10px';
        if (containerRef.current) {
            // Append GUI to container so it's removed with component if possible, 
            // or just rely on global cleanup. lil-gui appends to body by default unless specified.
            // We'll leave it default and clean up in useEffect return.
        }

        side = p.width / cols;

        // 初始化 3D 摄像机
        cam = p.createCamera();
        cam.setPosition(0, -600, 800);
        cam.lookAt(0, 0, 0);

        // 初始化网络摄像头
        video = p.createCapture(p.VIDEO);
        video.size(cols, rows);
        video.hide();

        p.frameRate(30);

        directions = [
          { desc: "LEFT", dir: p.createVector(-1, 0, 0), pivotPt: p.createVector(-1, 1, 0) },
          { desc: "RIGHT", dir: p.createVector(1, 0, 0), pivotPt: p.createVector(1, 1, 0) },
          { desc: "BACKWARD", dir: p.createVector(0, 0, -1), pivotPt: p.createVector(0, 1, -1) },
          { desc: "FORWARD", dir: p.createVector(0, 0, 1), pivotPt: p.createVector(0, 1, 1) },
        ];

        // 创建方块矩阵
        for (let j = 0; j < rows; j++) {
          for (let i = 0; i < cols; i++) {
            let x = -p.width / 2 + i * p.width / cols + side / 2;
            let z = -p.height / 2 + j * p.height / rows + side / 2;
            boxes.push(new RollBox(p, x, 0, z, side));
          }
        }

        p.describe("通过摄像头动作速度和幅度控制方块的翻滚速度与颜色");
      };

      p.draw = () => {
        p.background(10, 5, 20);

        if (params.rotateMode) {
          let rot = p.frameCount * p.TWO_PI / params.globalRotationFrames;
          p.rotateY(rot);
        }

        if (params.lightsOn) {
          p.ambientLight(40, 20, 60);
          p.pointLight(255, 0, 200, 0, -200, 200);
          p.directionalLight(0, 255, 255, 1, 1, -1);
          p.directionalLight(200, 50, 255, -1, 0, -1);
        } else {
          p.ambientLight(255);
        }

        // --- 视频动作捕捉逻辑 ---
        video.loadPixels();
        const vidPixels = (video as any).pixels; // Cast to any to access pixels if type definition is missing/incomplete for MediaElement
        if (vidPixels && vidPixels.length > 0) {
          for (let y = 0; y < rows; y++) {
            for (let x = 0; x < cols; x++) {
              let videoX = cols - 1 - x;
              let index = (videoX + y * cols) * 4;

              let r = vidPixels[index];
              let g = vidPixels[index + 1];
              let b = vidPixels[index + 2];
              let bright = (r + g + b) / 3;

              let boxIndex = x + y * cols;

              if (prevPixels[boxIndex] !== undefined) {
                let diff = p.abs(bright - prevPixels[boxIndex]);
                let isTriggered = false;
                let intensity = 0;

                // 使用 GUI 的 threshold
                let threshold = params.threshold;

                if (diff > threshold) {
                  isTriggered = true;
                  // 计算动作剧烈程度 (0.0 - 1.0)
                  intensity = p.constrain(p.map(diff, threshold, 100, 0, 1), 0, 1);
                } else if (params.autoMarch && p.random(1) < 0.005) {
                  isTriggered = true;
                  intensity = p.random(0.2, 0.8);
                }

                if (isTriggered) {
                  // 根据剧烈程度映射动画速度
                  let speedFrames = p.map(intensity, 0, 1, 30, 4);
                  boxes[boxIndex].startAnimation(null, speedFrames, intensity);
                }
              }

              prevPixels[boxIndex] = bright;
            }
          }
        }

        for (let rollbox of boxes) {
          rollbox.update();
          rollbox.show();
        }

        p.orbitControl();
      };
      
      p.windowResized = () => {
         p.resizeCanvas(p.min(p.windowWidth, p.windowHeight), p.min(p.windowWidth, p.windowHeight));
      };
    };

    const myP5 = new p5(sketch, containerRef.current);

    return () => {
      myP5.remove();
      // Cleanup GUI
      const guis = document.querySelectorAll('.lil-gui');
      guis.forEach(el => el.remove());
    };
  }, []);

  return <div ref={containerRef} style={{ width: '100%', height: '100vh', overflow: 'hidden', background: '#0a0514' }} />;
}
