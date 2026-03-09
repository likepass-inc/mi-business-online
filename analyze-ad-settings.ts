/**
 * 広告設定ファイル解析スクリプト
 * キーワードターゲティングとコンバージョンの関係を分析
 */

import ExcelJS from 'exceljs';
import * as fs from 'fs/promises';
import * as path from 'path';

interface SheetData {
  name: string;
  headers: string[];
  rows: any[][];
}

function getCellValue(cell: ExcelJS.Cell | null | undefined): any {
  if (!cell) return null;
  
  if (cell.value === null || cell.value === undefined) {
    return null;
  }
  
  if (typeof cell.value === 'number') {
    return cell.value;
  }
  
  if (cell.value instanceof Date) {
    return cell.value;
  }
  
  if (typeof cell.value === 'object' && 'richText' in cell.value) {
    const richText = cell.value as any;
    if (richText.richText && Array.isArray(richText.richText)) {
      return richText.richText.map((rt: any) => rt.text || '').join('');
    }
  }
  
  if (typeof cell.value === 'object' && 'text' in cell.value) {
    return (cell.value as any).text;
  }
  
  return String(cell.value);
}

function extractSheetData(worksheet: ExcelJS.Worksheet): SheetData {
  const headers: string[] = [];
  const rows: any[][] = [];
  
  let headerRowIndex = -1;
  let maxColumns = 0;
  
  worksheet.eachRow((row) => {
    const rowLength = row.actualCellCount || 0;
    if (rowLength > maxColumns) {
      maxColumns = rowLength;
    }
  });
  
  for (let rowNum = 1; rowNum <= Math.min(10, worksheet.rowCount); rowNum++) {
    const row = worksheet.getRow(rowNum);
    let nonEmptyCells = 0;
    const tempHeaders: string[] = [];
    
    for (let colNum = 1; colNum <= maxColumns; colNum++) {
      const cell = row.getCell(colNum);
      const value = getCellValue(cell);
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        nonEmptyCells++;
        tempHeaders.push(String(value).trim());
      } else {
        tempHeaders.push('');
      }
    }
    
    const headerText = tempHeaders.join(' ').toLowerCase();
    if (nonEmptyCells >= 2 && (
      headerText.includes('キーワード') || 
      headerText.includes('keyword') ||
      headerText.includes('キャンペーン') ||
      headerText.includes('campaign') ||
      headerText.includes('広告') ||
      headerText.includes('ad') ||
      rowNum === 1
    )) {
      headerRowIndex = rowNum;
      headers.push(...tempHeaders);
      break;
    }
  }
  
  if (headerRowIndex === -1 && worksheet.rowCount > 0) {
    headerRowIndex = 1;
    const firstRow = worksheet.getRow(1);
    for (let colNum = 1; colNum <= maxColumns; colNum++) {
      const cell = firstRow.getCell(colNum);
      const value = getCellValue(cell);
      headers.push(value !== null && value !== undefined ? String(value).trim() : `列${colNum}`);
    }
  }
  
  for (let rowNum = headerRowIndex + 1; rowNum <= worksheet.rowCount; rowNum++) {
    const row = worksheet.getRow(rowNum);
    const rowData: any[] = [];
    let hasData = false;
    
    for (let colNum = 1; colNum <= Math.max(headers.length, maxColumns); colNum++) {
      const cell = row.getCell(colNum);
      const value = getCellValue(cell);
      
      if (value !== null && value !== undefined && String(value).trim() !== '') {
        hasData = true;
      }
      
      if (value instanceof Date) {
        rowData.push(value.toLocaleDateString('ja-JP'));
      } else {
        rowData.push(value);
      }
    }
    
    if (hasData) {
      rows.push(rowData);
    }
  }
  
  return {
    name: worksheet.name,
    headers: headers.filter(h => h !== ''),
    rows,
  };
}

async function analyzeAdSettings() {
  const filePath = '/Users/nakamuratakeshi/Downloads/三越伊勢丹様 法人向けEC（ディスプレイ広告）_設定一覧_v4_20251014.xlsx';
  
  try {
    console.log('📊 広告設定ファイルを読み込み中...\n');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);
    
    const wbName = 'name' in workbook ? String((workbook as Record<string, unknown>).name ?? 'N/A') : 'N/A';
    console.log(`ワークブック名: ${wbName}`);
    console.log(`シート数: ${workbook.worksheets.length}\n`);
    
    const sheets: SheetData[] = [];
    
    workbook.worksheets.forEach((worksheet, index) => {
      console.log(`シート ${index + 1}: ${worksheet.name}`);
      const sheetData = extractSheetData(worksheet);
      sheets.push(sheetData);
      console.log(`  - ヘッダー数: ${sheetData.headers.length}`);
      console.log(`  - データ行数: ${sheetData.rows.length}`);
      if (sheetData.headers.length > 0) {
        console.log(`  - ヘッダー: ${sheetData.headers.slice(0, 10).join(', ')}${sheetData.headers.length > 10 ? '...' : ''}`);
      }
      console.log('');
    });
    
    // JSON形式で保存
    const jsonPath = `ad-settings-${new Date().toISOString().split('T')[0]}.json`;
    await fs.writeFile(jsonPath, JSON.stringify(sheets, null, 2), 'utf-8');
    console.log(`✅ JSONデータを ${jsonPath} に保存しました\n`);
    
    // キーワード分析用のMarkdownレポートを生成
    const markdown = generateKeywordAnalysisReport(sheets);
    const mdPath = `ad-keyword-analysis-${new Date().toISOString().split('T')[0]}.md`;
    await fs.writeFile(mdPath, markdown, 'utf-8');
    console.log(`✅ キーワード分析レポートを ${mdPath} に保存しました\n`);
    
    console.log('--- レポートプレビュー ---\n');
    console.log(markdown.substring(0, 2000));
    if (markdown.length > 2000) {
      console.log(`\n... (残り ${markdown.length - 2000} 文字) ...\n`);
    }
    
  } catch (error) {
    console.error('❌ エラー:', error instanceof Error ? error.message : String(error));
    if (error instanceof Error) {
      console.error('スタック:', error.stack);
    }
    process.exit(1);
  }
}

function generateKeywordAnalysisReport(sheets: SheetData[]): string {
  let md = `# 広告設定ファイル キーワード分析レポート\n\n`;
  md += `**ファイル**: 三越伊勢丹様 法人向けEC（ディスプレイ広告）_設定一覧_v4_20251014.xlsx\n`;
  md += `**解析日時**: ${new Date().toLocaleString('ja-JP')}\n\n`;
  md += `---\n\n`;
  
  // キーワード関連のシートを探す
  const keywordSheets = sheets.filter(sheet => 
    sheet.name.toLowerCase().includes('キーワード') ||
    sheet.name.toLowerCase().includes('keyword') ||
    sheet.headers.some(h => h.toLowerCase().includes('キーワード') || h.toLowerCase().includes('keyword'))
  );
  
  // キャンペーン関連のシートを探す
  const campaignSheets = sheets.filter(sheet => 
    sheet.name.toLowerCase().includes('キャンペーン') ||
    sheet.name.toLowerCase().includes('campaign')
  );
  
  md += `## 📋 シート一覧\n\n`;
  md += `| シート名 | ヘッダー数 | データ行数 | 種類 |\n`;
  md += `|----------|-----------|-----------|------|\n`;
  sheets.forEach(sheet => {
    const type = keywordSheets.includes(sheet) ? 'キーワード' : 
                campaignSheets.includes(sheet) ? 'キャンペーン' : 'その他';
    md += `| ${sheet.name} | ${sheet.headers.length} | ${sheet.rows.length} | ${type} |\n`;
  });
  md += `\n`;
  
  // 各シートの詳細分析
  sheets.forEach((sheet, index) => {
    md += `## ${index + 1}. ${sheet.name}\n\n`;
    
    if (sheet.headers.length === 0) {
      md += `*このシートにはデータがありません。*\n\n`;
      return;
    }
    
    // ヘッダーを表示
    md += `### ヘッダー\n\n`;
    md += `| 列番号 | ヘッダー名 |\n`;
    md += `|--------|-----------|\n`;
    sheet.headers.forEach((header, i) => {
      if (header && header.trim() !== '') {
        md += `| ${i + 1} | ${header} |\n`;
      }
    });
    md += `\n`;
    
    // キーワード列を特定
    const keywordColumnIndex = sheet.headers.findIndex(h => 
      h && (h.toLowerCase().includes('キーワード') || 
           h.toLowerCase().includes('keyword') ||
           h.toLowerCase().includes('検索語') ||
           h.toLowerCase().includes('search'))
    );
    
    // キャンペーン列を特定
    const campaignColumnIndex = sheet.headers.findIndex(h => 
      h && (h.toLowerCase().includes('キャンペーン') || 
           h.toLowerCase().includes('campaign'))
    );
    
    // マッチタイプ列を特定
    const matchTypeColumnIndex = sheet.headers.findIndex(h => 
      h && (h.toLowerCase().includes('マッチ') || 
           h.toLowerCase().includes('match') ||
           h.toLowerCase().includes('タイプ') ||
           h.toLowerCase().includes('type'))
    );
    
    // データのサンプルを表示
    if (sheet.rows.length > 0) {
      md += `### データサンプル（最初の20行）\n\n`;
      
      // テーブルヘッダー
      md += `| ${sheet.headers.slice(0, Math.min(10, sheet.headers.length)).join(' | ')} |\n`;
      md += `| ${sheet.headers.slice(0, Math.min(10, sheet.headers.length)).map(() => '---').join(' | ')} |\n`;
      
      // データ行
      sheet.rows.slice(0, 20).forEach(row => {
        const formattedRow = sheet.headers.slice(0, Math.min(10, sheet.headers.length)).map((_, i) => {
          const value = row[i];
          if (value === null || value === undefined || value === '') return '-';
          if (typeof value === 'number') return value.toLocaleString('ja-JP');
          return String(value).substring(0, 50);
        });
        md += `| ${formattedRow.join(' | ')} |\n`;
      });
      md += `\n`;
      
      // キーワード分析
      if (keywordColumnIndex >= 0) {
        md += `### キーワード分析\n\n`;
        
        const keywords: string[] = [];
        sheet.rows.forEach(row => {
          const keyword = row[keywordColumnIndex];
          if (keyword && String(keyword).trim() !== '' && String(keyword) !== '-') {
            keywords.push(String(keyword).trim());
          }
        });
        
        md += `**総キーワード数**: ${keywords.length}\n\n`;
        
        if (keywords.length > 0) {
          md += `**キーワード一覧（最初の50件）**:\n\n`;
          keywords.slice(0, 50).forEach((kw, i) => {
            md += `${i + 1}. ${kw}\n`;
          });
          if (keywords.length > 50) {
            md += `\n... 他 ${keywords.length - 50} 件\n`;
          }
          md += `\n`;
          
          // キーワードのカテゴリ分析
          md += `### キーワードカテゴリ分析\n\n`;
          
          const categories: { [key: string]: string[] } = {
            'お歳暮関連': [],
            '法人関連': [],
            'ギフト関連': [],
            'その他': []
          };
          
          keywords.forEach(kw => {
            const lowerKw = kw.toLowerCase();
            if (lowerKw.includes('歳暮') || lowerKw.includes('せいぼ') || lowerKw.includes('oseibo')) {
              categories['お歳暮関連'].push(kw);
            } else if (lowerKw.includes('法人') || lowerKw.includes('ビジネス') || lowerKw.includes('business') || lowerKw.includes('企業')) {
              categories['法人関連'].push(kw);
            } else if (lowerKw.includes('ギフト') || lowerKw.includes('gift') || lowerKw.includes('贈答')) {
              categories['ギフト関連'].push(kw);
            } else {
              categories['その他'].push(kw);
            }
          });
          
          Object.entries(categories).forEach(([category, kws]) => {
            if (kws.length > 0) {
              md += `**${category}**: ${kws.length}件\n`;
              md += `- ${kws.slice(0, 10).join(', ')}${kws.length > 10 ? '...' : ''}\n\n`;
            }
          });
        }
      }
    }
    
    md += `---\n\n`;
  });
  
  md += `*このレポートは自動生成されました。*\n`;
  
  return md;
}

analyzeAdSettings();

