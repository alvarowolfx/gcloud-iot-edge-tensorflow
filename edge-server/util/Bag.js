
class Bag {
  constructor() {    
    this.bag = {}    
  }

  keyExtractor( item ) {
    return item
  }

  add( item ) {
    const key = this.keyExtractor( item )    
    if ( this.contains( item ) ) {
      this.bag[key] += 1
    } else {
      this.bag[key] = 1
    }
  }

  remove( item ) {
    const key = this.keyExtractor( item )    
    if ( this.contains( item ) ) {
      if ( this.count( item ) > 1 ) {
        this.bag[key] -= 1
      } else {
        delete this.bag[key]
      }
    } 
  }

  contains( item ) {
    const key = this.keyExtractor( item )    
    return !!this.bag[key]
  }

  count( item ) {
    const key = this.keyExtractor( item )    
    return this.bag[key]
  }

  toArray() {
    return Object.keys( this.bag )
  }   
  
  toObject() {
    return { ...this.bag }
  }
}

module.exports = Bag
