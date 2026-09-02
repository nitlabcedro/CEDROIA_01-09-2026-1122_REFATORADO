/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Microscope, Beaker, Atom, Dna as DnaIcon, FlaskConical, FlaskRound, TestTube2, TestTubes, Pipette, Thermometer, Biohazard, Activity } from 'lucide-react';

export default function LabBackground() {
  const icons = [
  Microscope, Beaker, Atom, DnaIcon, FlaskConical, FlaskRound, TestTube2, TestTubes, Pipette, Thermometer, Biohazard, Activity];


  const pattern = React.useMemo(() => {
    const rows = 7;
    const cols = 9;
    const cells: {Icon: any;top: string;left: string;rotate: number;size: number;}[] = [];

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const top = r / rows * 100 + 100 / rows / 2;
        const left = c / cols * 100 + 100 / cols / 2;

        const index = r * cols + c;
        cells.push({
          Icon: icons[index % icons.length],
          top: `${top}%`,
          left: `${left}%`,
          rotate: index * 45 % 360,
          size: 28 + index % 3 * 14
        });
      }
    }
    return cells;
  }, []);

  return (
    <div className="fundo-laboratorio__padrao">
      {pattern.map((item, i) =>
      <div
        key={i}
        className={`fundo-laboratorio__molecula ${
        i % 4 === 0 ? "fundo-laboratorio__padrao-icone--primario" :
        i % 6 === 0 ? "fundo-laboratorio__padrao-icone--secundario" :
        "fundo-laboratorio__padrao-icone--neutro"}`
        }
        style={{
          top: item.top,
          left: item.left,
          transform: `translate(-50%, -50%) rotate(${item.rotate}deg)`
        }}>
        
          <item.Icon size={item.size} strokeWidth={1.2} />
        </div>
      )}
    </div>);

}
