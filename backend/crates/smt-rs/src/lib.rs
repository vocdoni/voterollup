// https://github.com/iden3/circomlib/blob/master/src/smt.js

use std::{hash, marker::PhantomData};

use anyhow::Result;
use thiserror::Error;

trait Hasher<const NK: usize> {
    fn empty() -> [u8; NK];
    fn is_empty(e: &[u8;NK]) -> bool;
    fn digest(e: &[u8]) -> [u8; NK];
}

trait Backend<H: Hasher<NK>, const NK: usize, const NV: usize> {
    fn set_root(&mut self, h: &[u8; NK]) -> Result<()>;
    fn get(&self, k: &[u8; NK]) -> Result<Option<[u8; NV]>>;
    fn multi_get(&self, k: &[[u8; NK]]) -> Result<Vec<Option<[u8; NV]>>>;
    fn multi_insert(&mut self, values: &[([u8; NK], [u8; NV])]) -> Result<()>;
    fn multi_delete(&mut self, keys: &[[u8; NK]]) -> Result<()>;
}

struct MemoryBackend<H: Hasher<NK>, const NK: usize, const NV: usize> {
    root: [u8; NK],
    leafs: std::collections::HashMap<[u8; NK], [u8; NV]>,
    _phantom: std::marker::PhantomData<H>,
}

impl<H: Hasher<NK>, const NK: usize, const NV: usize> Default for MemoryBackend<H, NK, NV> {
    fn default() -> Self {
        Self {
            root: H::empty(),
            leafs: std::collections::HashMap::new(),
            _phantom: std::marker::PhantomData,
        }
    }
}

impl<H: Hasher<NK>, const NK: usize, const NV: usize> Backend<H, NK, NV> for MemoryBackend<H, NK, NV> {
    fn set_root(&mut self, h: &[u8; NK]) -> Result<()> {
        self.root = *h;
        Ok(())
    }
    fn get(&self, k: &[u8; NK]) -> Result<Option<[u8; NV]>> {
        Ok(self.leafs.get(k).copied())
    }
    fn multi_get(&self, mk: &[[u8; NK]]) -> Result<Vec<Option<[u8; NV]>>> {
        Ok(mk.iter().map(|k| self.leafs.get(k).copied()).collect())
    }
    fn multi_insert(&mut self, kvs: &[([u8; NK], [u8; NV])]) -> Result<()> {
        kvs.iter().for_each(|(k, v)| {
            self.leafs.insert(*k, *v);
        });
        Ok(())
    }
    fn multi_delete(&mut self, keys: &[[u8; NK]]) -> Result<()> {
        keys.iter().for_each(|k| {
            self.leafs.remove(k);
        });
        Ok(())
    }
}

struct SMT<H: Hasher<NK>, B: Backend<H,NK,NV>, const NK: usize, const NV: usize>{
   backend : B,
   root: [u8;NK],
   _phantom : std::marker::PhantomData<H>
}

struct InsertReceipt<const NK: usize> {
   old_root: [u8;NK],
}

struct U8ArrayBitIterator<'a, const N: usize> {
   u8n : &'a[u8;N],
   offset: usize,
}


fn bit_iter<'a, const N: usize>(u8n: &'a[u8;N]) -> U8ArrayBitIterator<'a, N> {
    U8ArrayBitIterator {
        u8n,
        offset: 0,
    }
}

impl<'a, const N: usize> Iterator for U8ArrayBitIterator<'a, N> {
    type Item = bool;
    fn next(&mut self) -> Option<Self::Item> {
        if self.offset >= 8*N {
            None
        } else {
            let bit = self.u8n[self.offset/8] >> ( 7 - self.offset%8 );
            self.offset+=1;
            Some(bit & 1 == 1)
        }
    }
}
/*
impl<H: Hasher<NK, NV>, B: Backend<H,NK, NV>, const NK: usize, const NV: usize> SMT<H,B, NK, NV>
{
    pub fn new(backend: B) -> Self {
        SMT { backend, root: H::empty(), _phantom: PhantomData } 
    }

    fn key_path(key: &[u8;NK]) -> [bool;8*NK]{
        let path = [false;8*NK];        
        while 
        const res = Scalar.bits(_key);

        while (res.length<256) res.push(false);

        return res;
    } 

    pub fn insert(&mut self, key : &[u8;NK], value: &[u8;NK]) { 
        let added_one = false;
        let receipt_old_root = self.root;
        const newKeyBits = this._splitBits(key);

        let rtOld;

        const resFind = await this.find(key);

        if (resFind.found) throw new Error("Key already exists");

        res.siblings = resFind.siblings;
        let mixed;

        if (!resFind.isOld0) {
            const oldKeyits = this._splitBits(resFind.notFoundKey);
            for (let i= res.siblings.length; oldKeyits[i] == newKeyBits[i]; i++) {
                res.siblings.push(F.zero);
            }
            rtOld = hash1(resFind.notFoundKey, resFind.notFoundValue);
            res.siblings.push(rtOld);
            addedOne = true;
            mixed = false;
        } else if (res.siblings.length >0) {
            mixed = true;
            rtOld = F.zero;
        }

        const inserts = [];
        const dels = [];

        let rt = hash1(key, value);
        inserts.push([rt,[1, key, value]] );

        for (let i=res.siblings.length-1; i>=0; i--) {
            if ((i<res.siblings.length-1)&&(!F.isZero(res.siblings[i]))) {
                mixed = true;
            }
            if (mixed) {
                const oldSibling = resFind.siblings[i];
                if (newKeyBits[i]) {
                    rtOld = hash0(oldSibling, rtOld);
                } else {
                    rtOld = hash0(rtOld, oldSibling);
                }
                dels.push(rtOld);
            }


            let newRt;
            if (newKeyBits[i]) {
                newRt = hash0(res.siblings[i], rt);
                inserts.push([newRt,[res.siblings[i], rt]] );
            } else {
                newRt = hash0(rt, res.siblings[i]);
                inserts.push([newRt,[rt, res.siblings[i]]] );
            }
            rt = newRt;
        }

        if (addedOne) res.siblings.pop();
        while ((res.siblings.length>0) && (F.isZero(res.siblings[res.siblings.length-1]))) {
            res.siblings.pop();
        }
        res.oldKey = resFind.notFoundKey;
        res.oldValue = resFind.notFoundValue;
        res.newRoot = rt;
        res.isOld0 = resFind.isOld0;


        await this.db.multiIns(inserts);
        await this.db.setRoot(rt);
        this.root = rt;
        await this.db.multiDel(dels);

        return res;
    }
}
*/

mod tests {
    use super::*;
    #[cfg(test)]
    #[test]
    fn test_u8array_bit_iterator() {

        let res = bit_iter(&[129u8,2u8])
            .map(|bit| if bit { '1' } else { '0' })
            .collect::<String>();
        assert_eq!(res,"1000000100000010");
    }
}

